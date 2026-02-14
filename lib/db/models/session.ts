import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { Session } from "@/types/message";

let collection: Collection<Session>;

export async function getSessionsCollection(): Promise<Collection<Session>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<Session>("sessions");

  await collection.createIndex({ projectId: 1, updatedAt: -1 });
  await collection.createIndex({ userId: 1, status: 1 });

  return collection;
}

export async function findSessionsByProject(
  projectId: string
): Promise<Session[]> {
  const col = await getSessionsCollection();
  return col
    .find({ projectId: new ObjectId(projectId) })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findSessionById(id: string): Promise<Session | null> {
  const col = await getSessionsCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function createSession(
  data: Omit<
    Session,
    "_id" | "createdAt" | "updatedAt" | "messageCount" | "lastMessageAt"
  >
): Promise<Session> {
  const col = await getSessionsCollection();
  const now = new Date();
  const session: Session = {
    ...data,
    messageCount: 0,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(session);
  return { ...session, _id: result.insertedId };
}

export async function incrementSessionMessageCount(
  id: string
): Promise<void> {
  const col = await getSessionsCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    {
      $inc: { messageCount: 1 },
      $set: { lastMessageAt: new Date(), updatedAt: new Date() },
    }
  );
}
