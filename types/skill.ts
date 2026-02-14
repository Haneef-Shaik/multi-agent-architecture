export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  dirPath: string;
  hasReferences: boolean;
  hasScripts: boolean;
  hasAssets: boolean;
  referenceFiles: string[];
  scriptFiles: string[];
  assetFiles: string[];
}

export type SkillLoadLevel = "metadata" | "body" | "reference";

export interface LoadedSkill {
  metadata: SkillMetadata;
  body?: string;
  loadedReferences: Map<string, string>;
}
