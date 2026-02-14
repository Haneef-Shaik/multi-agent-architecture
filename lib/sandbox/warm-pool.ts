import path from "path";
import fs from "fs/promises";
import {
  createSandboxContainer,
  removeSandboxContainer,
  type ContainerInfo,
} from "./docker-client";

const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT ?? path.join(process.cwd(), ".workspaces");

const DEFAULT_POOL_SIZE = parseInt(process.env.WARM_POOL_SIZE ?? "5", 10);
const POOL_CHECK_INTERVAL_MS = 30_000; // Check pool every 30s

interface PooledContainer {
  info: ContainerInfo;
  volumePath: string;
  createdAt: number;
}

/**
 * WarmPool maintains a set of pre-created sandbox containers
 * to reduce cold start time when users provision new sandboxes.
 *
 * Instead of waiting for container creation + start (~3-5s),
 * users get a pre-warmed container immediately (~100ms).
 */
export class WarmPool {
  private pool: PooledContainer[] = [];
  private targetSize: number;
  private filling = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(targetSize = DEFAULT_POOL_SIZE) {
    this.targetSize = targetSize;
  }

  /**
   * Start the warm pool — fills it to target size and
   * starts a periodic check to maintain the pool level.
   */
  async start(): Promise<void> {
    await this.fill();
    this.timer = setInterval(() => this.fill(), POOL_CHECK_INTERVAL_MS);
  }

  /**
   * Stop the warm pool — cleans up all pooled containers.
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.drainAll();
  }

  /**
   * Acquire a pre-warmed container from the pool.
   * Returns null if the pool is empty (caller should create one from scratch).
   */
  acquire(): PooledContainer | null {
    const container = this.pool.shift() ?? null;
    // Trigger background fill to replenish
    if (container) {
      this.fill().catch(() => {});
    }
    return container;
  }

  /**
   * Return a container to the pool (e.g., if project creation failed).
   */
  release(container: PooledContainer): void {
    if (this.pool.length < this.targetSize) {
      this.pool.push(container);
    } else {
      // Pool is full, destroy the container
      removeSandboxContainer(container.info.containerId).catch(() => {});
      fs.rm(container.volumePath, { recursive: true, force: true }).catch(
        () => {}
      );
    }
  }

  /**
   * Fill the pool up to the target size.
   */
  private async fill(): Promise<void> {
    if (this.filling) return;
    this.filling = true;

    try {
      const needed = this.targetSize - this.pool.length;
      if (needed <= 0) return;

      // Create containers in parallel, up to 3 at a time
      const batchSize = Math.min(needed, 3);
      for (let batch = 0; batch < needed; batch += batchSize) {
        const count = Math.min(batchSize, needed - batch);
        const promises = Array.from({ length: count }, () =>
          this.createPooledContainer()
        );
        const results = await Promise.allSettled(promises);
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            this.pool.push(r.value);
          }
        }
      }
    } finally {
      this.filling = false;
    }
  }

  private async createPooledContainer(): Promise<PooledContainer> {
    const id = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const volumePath = path.join(WORKSPACE_ROOT, "_pool", id);
    await fs.mkdir(volumePath, { recursive: true });

    const info = await createSandboxContainer({
      name: `warm-${id}`,
      volumePath,
    });

    return {
      info,
      volumePath,
      createdAt: Date.now(),
    };
  }

  /**
   * Remove all pooled containers.
   */
  private async drainAll(): Promise<void> {
    const containers = this.pool.splice(0);
    await Promise.allSettled(
      containers.map(async (c) => {
        await removeSandboxContainer(c.info.containerId);
        await fs.rm(c.volumePath, { recursive: true, force: true });
      })
    );
  }

  get size(): number {
    return this.pool.length;
  }

  get target(): number {
    return this.targetSize;
  }
}

// Singleton instance
export const warmPool = new WarmPool();
