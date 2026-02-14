import { NextResponse } from "next/server";
import { skillRegistry } from "@/lib/skills/registry";

export async function GET() {
  await skillRegistry.initialize();
  const metadata = skillRegistry.getAllMetadata();

  return NextResponse.json(
    metadata.map((m) => ({
      name: m.name,
      description: m.description,
      version: m.version,
      hasReferences: m.hasReferences,
      hasScripts: m.hasScripts,
      referenceFiles: m.referenceFiles,
    }))
  );
}
