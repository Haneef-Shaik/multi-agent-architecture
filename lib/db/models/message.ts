import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { Message } from "@/types/message";

let collection: Collection<Message>;

export async function getMessagesCollection(): Promise<Collection<Message>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<Message>("messages");

  await collection.createIndex({ sessionId: 1, createdAt: 1 });

  return collection;
}

export async function findMessagesBySession(
  sessionId: string,
  options?: { limit?: number; before?: Date }
): Promise<Message[]> {
  const col = await getMessagesCollection();
  const filter: Record<string, unknown> = {
    sessionId: new ObjectId(sessionId),
  };
  if (options?.before) {
    filter.createdAt = { $lt: options.before };
  }
  return col
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(options?.limit ?? 100)
    .toArray();
}

export async function createMessage(
  data: Omit<Message, "_id" | "createdAt">
): Promise<Message> {
  const col = await getMessagesCollection();
  const message: Message = {
    ...data,
    createdAt: new Date(),
  };
  const result = await col.insertOne(message);
  return { ...message, _id: result.insertedId };
}
