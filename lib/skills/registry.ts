import { readdir, readFile, access } from "fs/promises";
import { join } from "path";
import type { SkillMetadata, LoadedSkill } from "@/types/skill";

const SKILLS_DIR = join(process.cwd(), ".agents", "skills");

class SkillRegistry {
  private metadata: Map<string, SkillMetadata> = new Map();
  private bodyCache: Map<string, string> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    await Promise.all(
      dirs.map(async (dir) => {
        try {
          const skillPath = join(SKILLS_DIR, dir.name);
          const skillMdPath = join(skillPath, "SKILL.md");

          await access(skillMdPath);
          const content = await readFile(skillMdPath, "utf-8");
          const { frontmatter } = parseFrontmatter(content);

          if (!frontmatter.name || !frontmatter.description) return;

          const meta: SkillMetadata = {
            name: frontmatter.name,
            description: frontmatter.description,
            version: frontmatter.version,
            dirPath: skillPath,
            hasReferences: await dirExists(join(skillPath, "references")),
            hasScripts: await dirExists(join(skillPath, "scripts")),
            hasAssets: await dirExists(join(skillPath, "assets")),
            referenceFiles: await listDirSafe(join(skillPath, "references")),
            scriptFiles: await listDirSafe(join(skillPath, "scripts")),
            assetFiles: await listDirSafe(join(skillPath, "assets")),
          };

          this.metadata.set(dir.name, meta);
        } catch {
          // Skip skills without valid SKILL.md
        }
      })
    );

    this.initialized = true;
  }

  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadata.values());
  }

  getMetadata(name: string): SkillMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Get a compact string of all skill names and descriptions
   * suitable for injection into the Supervisor's context
   */
  getMetadataDigest(): string {
    const lines = Array.from(this.metadata.entries()).map(
      ([key, meta]) => `- **${key}**: ${meta.description}`
    );
    return `# Available Skills (${lines.length})\n\n${lines.join("\n")}`;
  }

  /**
   * Level 2: Load the full SKILL.md body (without frontmatter)
   */
  async loadSkillBody(name: string): Promise<string | null> {
    if (this.bodyCache.has(name)) return this.bodyCache.get(name)!;

    const meta = this.metadata.get(name);
    if (!meta) return null;

    const content = await readFile(join(meta.dirPath, "SKILL.md"), "utf-8");
    const { body } = parseFrontmatter(content);
    this.bodyCache.set(name, body);
    return body;
  }

  /**
   * Level 3: Load a specific reference file
   */
  async loadReference(
    skillName: string,
    fileName: string
  ): Promise<string | null> {
    const meta = this.metadata.get(skillName);
    if (!meta) return null;

    try {
      const filePath = join(meta.dirPath, "references", fileName);
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Load a full skill object with metadata, optional body, and requested references
   */
  async loadSkill(
    name: string,
    options?: { loadBody?: boolean; references?: string[] }
  ): Promise<LoadedSkill | null> {
    const meta = this.metadata.get(name);
    if (!meta) return null;

    const skill: LoadedSkill = {
      metadata: meta,
      loadedReferences: new Map(),
    };

    if (options?.loadBody) {
      skill.body = (await this.loadSkillBody(name)) ?? undefined;
    }

    if (options?.references) {
      await Promise.all(
        options.references.map(async (ref) => {
          const content = await this.loadReference(name, ref);
          if (content) skill.loadedReferences.set(ref, content);
        })
      );
    }

    return skill;
  }

  /**
   * Simple keyword matching for skill selection.
   * Returns skills whose descriptions contain any of the keywords.
   */
  matchSkills(query: string, topK = 5): SkillMetadata[] {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter((w) => w.length > 3);

    const scored = Array.from(this.metadata.values()).map((meta) => {
      const descLower = meta.description.toLowerCase();
      const nameLower = meta.name.toLowerCase();
      let score = 0;

      for (const word of words) {
        if (descLower.includes(word)) score += 1;
        if (nameLower.includes(word)) score += 2;
      }

      return { meta, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.meta);
  }
}

// --- Helpers ---

function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] };
}

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listDirSafe(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path);
    return entries;
  } catch {
    return [];
  }
}

// Singleton
export const skillRegistry = new SkillRegistry();
