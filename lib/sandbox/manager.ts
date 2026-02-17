import path from "path";
import fs from "fs/promises";
import { ObjectId } from "mongodb";
import {
  createSandboxContainer,
  removeSandboxContainer,
  pauseSandboxContainer,
  unpauseSandboxContainer,
  getContainerStatus,
} from "./docker-client";
import {
  createSandbox,
  updateSandbox,
  findActiveSandbox,
  findSandboxById,
} from "@/lib/db/models/sandbox";
import type { SandboxStatus } from "@/types/project";

const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT ?? path.join(process.cwd(), ".workspaces");

/**
 * SandboxManager handles the full lifecycle of sandbox containers.
 *
 * Provision → Start → Active → Hibernate → Resume → Terminate
 */
export class SandboxManager {
  /**
   * Provision a new sandbox for a project.
   * Creates the workspace directory, spins up a Docker container,
   * and records it in the database.
   */
  async provision(
    userId: string,
    projectId: string,
    opts: { env?: Record<string, string> } = {}
  ): Promise<string> {
    // Check for existing active sandbox
    const existing = await findActiveSandbox(projectId);
    if (existing && existing.containerId) {
      // Verify the container actually exists in Docker
      let containerAlive = false;
      try {
        const status = await getContainerStatus(existing.containerId);
        containerAlive = status !== "not_found" && status !== "removing";
      } catch {
        containerAlive = false;
      }

      if (!containerAlive) {
        // Container was removed externally — mark as terminated and re-provision
        await updateSandbox(existing._id!.toString(), {
          status: "terminated",
          terminatedAt: new Date(),
        });
      } else {
        // Resume if hibernating
        if (existing.status === "hibernating") {
          await unpauseSandboxContainer(existing.containerId);
          await updateSandbox(existing._id!.toString(), {
            status: "active",
          });
          return existing._id!.toString();
        }
        // Already active
        if (existing.status === "active" || existing.status === "ready") {
          return existing._id!.toString();
        }
      }
    }

    // Create workspace directory on host
    const volumePath = path.join(WORKSPACE_ROOT, projectId);
    await fs.mkdir(volumePath, { recursive: true });

    const containerName = `sandbox-${projectId}-${Date.now()}`;

    // Create DB record first (status: provisioning)
    const sandbox = await createSandbox({
      userId: new ObjectId(userId),
      projectId: new ObjectId(projectId),
      containerId: "",
      status: "provisioning",
      ports: [],
      resources: {
        cpuCores: 2,
        memoryMB: 2048,
        diskMB: 10240,
      },
      volumePath,
      lastActiveAt: new Date(),
    });

    const sandboxId = sandbox._id!.toString();

    try {
      // Create and start container
      const containerInfo = await createSandboxContainer({
        name: containerName,
        volumePath,
        env: opts.env,
      });

      // Update DB with container info
      const portMappings = Object.entries(containerInfo.ports).map(
        ([internal, host]) => ({
          containerPort: parseInt(internal, 10),
          hostPort: host,
          protocol: "tcp" as const,
        })
      );

      await updateSandbox(sandboxId, {
        containerId: containerInfo.containerId,
        status: "active",
        ports: portMappings,
      });

      return sandboxId;
    } catch (error) {
      await updateSandbox(sandboxId, {
        status: "failed",
      });
      throw error;
    }
  }

  /**
   * Get sandbox info by ID. Verifies ownership.
   */
  async getInfo(
    sandboxId: string,
    userId: string
  ): Promise<{
    sandboxId: string;
    containerId: string;
    status: SandboxStatus;
    ports: Array<{ containerPort: number; hostPort: number; protocol: string }>;
    volumePath: string;
  } | null> {
    const sandbox = await findSandboxById(sandboxId);
    if (!sandbox || sandbox.userId.toString() !== userId) return null;

    return {
      sandboxId: sandbox._id!.toString(),
      containerId: sandbox.containerId ?? "",
      status: sandbox.status,
      ports: sandbox.ports ?? [],
      volumePath: sandbox.volumePath ?? "",
    };
  }

  /**
   * Hibernate a sandbox (pause the container, keep the volume).
   */
  async hibernate(sandboxId: string, userId: string): Promise<void> {
    const sandbox = await findSandboxById(sandboxId);
    if (!sandbox || sandbox.userId.toString() !== userId) {
      throw new Error("Sandbox not found");
    }

    if (sandbox.containerId && sandbox.status === "active") {
      await pauseSandboxContainer(sandbox.containerId);
      await updateSandbox(sandboxId, { status: "hibernating" });
    }
  }

  /**
   * Resume a hibernated sandbox.
   */
  async resume(sandboxId: string, userId: string): Promise<void> {
    const sandbox = await findSandboxById(sandboxId);
    if (!sandbox || sandbox.userId.toString() !== userId) {
      throw new Error("Sandbox not found");
    }

    if (sandbox.containerId && sandbox.status === "hibernating") {
      await unpauseSandboxContainer(sandbox.containerId);
      await updateSandbox(sandboxId, { status: "active" });
    }
  }

  /**
   * Terminate a sandbox (stop + remove container, keep volume).
   */
  async terminate(sandboxId: string, userId: string): Promise<void> {
    const sandbox = await findSandboxById(sandboxId);
    if (!sandbox || sandbox.userId.toString() !== userId) {
      throw new Error("Sandbox not found");
    }

    if (sandbox.containerId) {
      try {
        await removeSandboxContainer(sandbox.containerId);
      } catch {
        // Container might already be removed
      }
    }

    await updateSandbox(sandboxId, {
      status: "terminated",
      terminatedAt: new Date(),
    });
  }

  /**
   * Get the live container status from Docker.
   */
  async getLiveStatus(sandboxId: string): Promise<string> {
    const sandbox = await findSandboxById(sandboxId);
    if (!sandbox?.containerId) return "unknown";

    try {
      return await getContainerStatus(sandbox.containerId);
    } catch {
      return "not_found";
    }
  }

  /**
   * Resolve sandboxId to a containerId for tool execution.
   */
  async resolveContainerId(sandboxId: string): Promise<string | null> {
    const sandbox = await findSandboxById(sandboxId);
    return sandbox?.containerId ?? null;
  }
}

// Singleton instance
export const sandboxManager = new SandboxManager();
