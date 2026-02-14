import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { User } from "@/types/user";

let collection: Collection<User>;

export async function getUsersCollection(): Promise<Collection<User>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<User>("users");

  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ authProvider: 1, authProviderId: 1 });

  return collection;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const col = await getUsersCollection();
  return col.findOne({ email });
}

export async function findUserById(id: string): Promise<User | null> {
  const col = await getUsersCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function createUser(
  data: Omit<User, "_id" | "createdAt" | "updatedAt">
): Promise<User> {
  const col = await getUsersCollection();
  const now = new Date();
  const user: User = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(user);
  return { ...user, _id: result.insertedId };
}

export async function updateUser(
  id: string,
  data: Partial<User>
): Promise<void> {
  const col = await getUsersCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...data, updatedAt: new Date() } }
  );
}
