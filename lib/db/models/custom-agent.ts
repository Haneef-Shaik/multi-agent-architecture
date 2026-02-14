import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { CustomAgent } from "@/types/agent";

let collection: Collection<CustomAgent>;

export async function getCustomAgentsCollection(): Promise<
  Collection<CustomAgent>
> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<CustomAgent>("custom_agents");

  await collection.createIndex({ userId: 1, updatedAt: -1 });
  await collection.createIndex({ isPublic: 1, updatedAt: -1 });

  return collection;
}

export async function findCustomAgentsByUser(
  userId: string
): Promise<CustomAgent[]> {
  const col = await getCustomAgentsCollection();
  return col
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findPublicAgents(): Promise<CustomAgent[]> {
  const col = await getCustomAgentsCollection();
  return col.find({ isPublic: true }).sort({ updatedAt: -1 }).toArray();
}

export async function findCustomAgentById(
  id: string
): Promise<CustomAgent | null> {
  const col = await getCustomAgentsCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function createCustomAgent(
  data: Omit<CustomAgent, "_id" | "createdAt" | "updatedAt">
): Promise<CustomAgent> {
  const col = await getCustomAgentsCollection();
  const now = new Date();
  const doc: CustomAgent = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function updateCustomAgent(
  id: string,
  data: Partial<
    Pick<
      CustomAgent,
      | "name"
      | "description"
      | "systemPrompt"
      | "model"
      | "tools"
      | "skills"
      | "maxToolCalls"
      | "color"
      | "icon"
      | "isPublic"
    >
  >
): Promise<void> {
  const col = await getCustomAgentsCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...data, updatedAt: new Date() } }
  );
}

export async function deleteCustomAgent(id: string): Promise<void> {
  const col = await getCustomAgentsCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}
