import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { AgentExecution } from "@/types/agent";

let collection: Collection<AgentExecution>;

export async function getExecutionsCollection(): Promise<
  Collection<AgentExecution>
> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<AgentExecution>("agent_executions");

  await collection.createIndex({ sessionId: 1, createdAt: -1 });
  await collection.createIndex({ userId: 1, status: 1 });

  return collection;
}

export async function createExecution(
  data: Omit<AgentExecution, "_id" | "createdAt">
): Promise<AgentExecution> {
  const col = await getExecutionsCollection();
  const execution: AgentExecution = {
    ...data,
    createdAt: new Date(),
  };
  const result = await col.insertOne(execution);
  return { ...execution, _id: result.insertedId };
}

export async function updateExecution(
  id: string,
  data: Partial<AgentExecution>
): Promise<void> {
  const col = await getExecutionsCollection();
  await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
}

export async function findExecutionById(
  id: string
): Promise<AgentExecution | null> {
  const col = await getExecutionsCollection();
  return col.findOne({ _id: new ObjectId(id) });
}
