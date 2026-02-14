import { Collection } from "mongodb";
import { getDb } from "../client";
import type { Template } from "@/types/project";

let collection: Collection<Template>;

export async function getTemplatesCollection(): Promise<Collection<Template>> {
  if (collection) return collection;
  const db = await getDb();
  collection = db.collection<Template>("templates");

  await collection.createIndex({ category: 1, popularity: -1 });
  await collection.createIndex({ framework: 1 });

  return collection;
}

export async function findTemplates(options?: {
  category?: string;
  framework?: string;
}): Promise<Template[]> {
  const col = await getTemplatesCollection();
  const filter: Record<string, unknown> = {};
  if (options?.category) filter.category = options.category;
  if (options?.framework) filter.framework = options.framework;
  return col.find(filter).sort({ popularity: -1 }).toArray();
}
