import { ObjectId } from "mongodb";

export interface UserPreferences {
  defaultMode: "simple" | "developer";
  defaultFramework?: string;
  theme: "light" | "dark" | "system";
  defaultModel?: string;
}

export interface UserUsage {
  tokensUsedThisMonth: number;
  sandboxMinutesThisMonth: number;
}

export interface UserApiKeys {
  anthropic?: string;
  openai?: string;
  google?: string;
}

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  image?: string;
  authProvider: "github" | "google" | "email";
  authProviderId?: string;
  preferences: UserPreferences;
  usage: UserUsage;
  plan: "free" | "pro" | "team";
  apiKeys: UserApiKeys;
  createdAt: Date;
  updatedAt: Date;
}
