import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { Sandbox } from "@/types/project";

let collection: Collection<Sandbox>;

export async function getSandboxesCollection(): Promise<Collection<Sandbox>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<Sandbox>("sandboxes");

  await collection.createIndex({ userId: 1, status: 1 });
  await collection.createIndex(
    { projectId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        status: { $in: ["provisioning", "ready", "active"] },
      },
    }
  );

  return collection;
}

export async function findSandboxById(
  id: string
): Promise<Sandbox | null> {
  const col = await getSandboxesCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function findActiveSandbox(
  projectId: string
): Promise<Sandbox | null> {
  const col = await getSandboxesCollection();
  return col.findOne({
    projectId: new ObjectId(projectId),
    status: { $in: ["provisioning", "ready", "active"] },
  });
}

export async function createSandbox(
  data: Omit<Sandbox, "_id" | "createdAt">
): Promise<Sandbox> {
  const col = await getSandboxesCollection();
  const sandbox: Sandbox = {
    ...data,
    createdAt: new Date(),
  };
  const result = await col.insertOne(sandbox);
  return { ...sandbox, _id: result.insertedId };
}

export async function updateSandbox(
  id: string,
  data: Partial<Sandbox>
): Promise<void> {
  const col = await getSandboxesCollection();
  await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
}
