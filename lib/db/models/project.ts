import { Collection, ObjectId } from "mongodb";
import { getDb } from "../client";
import type { Project } from "@/types/project";

let collection: Collection<Project>;

export async function getProjectsCollection(): Promise<Collection<Project>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<Project>("projects");

  await collection.createIndex({ userId: 1, updatedAt: -1 });
  await collection.createIndex({ userId: 1, name: 1 }, { unique: true });

  return collection;
}

export async function findProjectsByUser(userId: string): Promise<Project[]> {
  const col = await getProjectsCollection();
  return col
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findProjectById(id: string): Promise<Project | null> {
  const col = await getProjectsCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function createProject(
  data: Omit<Project, "_id" | "createdAt" | "updatedAt" | "lastOpenedAt">
): Promise<Project> {
  const col = await getProjectsCollection();
  const now = new Date();
  const project: Project = {
    ...data,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(project);
  return { ...project, _id: result.insertedId };
}

export async function updateProject(
  id: string,
  data: Partial<Project>
): Promise<void> {
  const col = await getProjectsCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...data, updatedAt: new Date() } }
  );
}

export async function deleteProject(id: string): Promise<void> {
  const col = await getProjectsCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}
