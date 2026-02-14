/**
 * AI Provider Registry
 *
 * Centralizes all LLM provider configurations. Supports:
 * - Anthropic (Claude models)
 * - OpenAI (GPT models)
 * - Google (Gemini models)
 * - AWS Bedrock (Claude, Llama, Mistral, Titan, etc. via AWS)
 * - Azure OpenAI (GPT models deployed on Azure)
 * - Azure AI Foundry (DeepSeek, Llama, Mistral, etc. via Azure AI)
 *
 * Model string format: "provider/model-id"
 * Examples:
 *   "anthropic/claude-sonnet-4-20250514"
 *   "openai/gpt-4o"
 *   "google/gemini-2.5-pro-preview-05-06"
 *   "bedrock/anthropic.claude-sonnet-4-20250514-v1:0"
 *   "bedrock/meta.llama3-1-70b-instruct-v1:0"
 *   "azure/gpt-4o"                  (Azure OpenAI deployment name)
 *   "azure-foundry/DeepSeek-R1"     (Azure AI Foundry model name)
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAzure as createAzureOpenAI } from "@ai-sdk/azure";
import { createAzure as createAzureFoundry } from "@quail-ai/azure-ai-provider";

// ---------------------------------------------------------------------------
// Provider factories — each creates a configured provider instance.
// Environment variables are read lazily so missing keys for unused
// providers don't cause errors on startup.
// ---------------------------------------------------------------------------

function anthropic() {
  return createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

function openai() {
  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function google() {
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}

function bedrock() {
  return createAmazonBedrock({
    region: process.env.AWS_REGION ?? process.env.AWS_BEDROCK_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  });
}

function azureOpenAI() {
  return createAzureOpenAI({
    resourceName: process.env.AZURE_RESOURCE_NAME,
    apiKey: process.env.AZURE_API_KEY,
  });
}

function azureFoundry() {
  return createAzureFoundry({
    endpoint: process.env.AZURE_AI_FOUNDRY_ENDPOINT,
    apiKey: process.env.AZURE_AI_FOUNDRY_API_KEY,
  });
}

// ---------------------------------------------------------------------------
// getProvider — resolves a "provider/model" string to an AI SDK model instance
// ---------------------------------------------------------------------------

export function getProvider(modelString: string) {
  const [provider, ...rest] = modelString.split("/");
  const modelId = rest.join("/");

  switch (provider) {
    case "anthropic":
      return anthropic()(modelId);

    case "openai":
      return openai()(modelId);

    case "google":
      return google()(modelId);

    case "bedrock":
      return bedrock()(modelId);

    case "azure":
      // Azure OpenAI — modelId is the deployment name
      return azureOpenAI()(modelId);

    case "azure-foundry":
      // Azure AI Foundry — modelId is the model/deployment name
      return azureFoundry()(modelId);

    default:
      // Fallback: try Anthropic with the full string
      return anthropic()(modelString);
  }
}

// ---------------------------------------------------------------------------
// Provider metadata — used by the UI for model selection
// ---------------------------------------------------------------------------

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  envVars: string[];
}

export interface ModelInfo {
  id: string; // "provider/model-id" — the full string to pass to getProvider
  name: string;
  provider: string;
  capabilities: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — best for coding, analysis, and complex reasoning",
    envVars: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models — versatile general-purpose models",
    envVars: ["OPENAI_API_KEY"],
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini models — multimodal with large context windows",
    envVars: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    description: "Access Claude, Llama, Mistral, and more via AWS infrastructure",
    envVars: ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    description: "GPT models deployed on your Azure OpenAI resource",
    envVars: ["AZURE_RESOURCE_NAME", "AZURE_API_KEY"],
  },
  {
    id: "azure-foundry",
    name: "Azure AI Foundry",
    description:
      "DeepSeek, Llama, Mistral, and other models via Microsoft Azure AI Foundry",
    envVars: ["AZURE_AI_FOUNDRY_ENDPOINT", "AZURE_AI_FOUNDRY_API_KEY"],
  },
];

export const MODELS: ModelInfo[] = [
  // --- Anthropic ---
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    capabilities: ["coding", "analysis", "tool-use"],
  },
  {
    id: "anthropic/claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "anthropic",
    capabilities: ["coding", "analysis", "reasoning", "tool-use"],
  },

  // --- OpenAI ---
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    capabilities: ["coding", "multimodal", "tool-use"],
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    capabilities: ["fast", "tool-use"],
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    capabilities: ["reasoning", "coding"],
  },
  {
    id: "openai/o4-mini",
    name: "o4-mini",
    provider: "openai",
    capabilities: ["reasoning", "fast"],
  },

  // --- Google ---
  {
    id: "google/gemini-3.0-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    capabilities: ["fast", "multimodal", "tool-use"],
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    capabilities: ["reasoning", "long-context", "tool-use"],
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    capabilities: ["fast", "multimodal", "tool-use"],
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2 Flash",
    provider: "google",
    capabilities: ["fast", "multimodal", "tool-use"],
  },
  {
    id: "google/gemini-2.0-flash-lite",
    name: "Gemini 2 Flash Lite",
    provider: "google",
    capabilities: ["fast", "efficient"],
  },
  {
    id: "google/gemini-2.0-pro-exp",
    name: "Gemini 2 Pro (Experimental)",
    provider: "google",
    capabilities: ["reasoning", "multimodal", "tool-use"],
  },

  // --- AWS Bedrock ---
  {
    id: "bedrock/anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude Sonnet 4 (Bedrock)",
    provider: "bedrock",
    capabilities: ["coding", "analysis", "tool-use"],
  },
  {
    id: "bedrock/anthropic.claude-opus-4-20250514-v1:0",
    name: "Claude Opus 4 (Bedrock)",
    provider: "bedrock",
    capabilities: ["coding", "reasoning", "tool-use"],
  },
  {
    id: "bedrock/meta.llama3-1-70b-instruct-v1:0",
    name: "Llama 3.1 70B (Bedrock)",
    provider: "bedrock",
    capabilities: ["coding", "open-source"],
  },
  {
    id: "bedrock/meta.llama3-1-405b-instruct-v1:0",
    name: "Llama 3.1 405B (Bedrock)",
    provider: "bedrock",
    capabilities: ["reasoning", "open-source"],
  },
  {
    id: "bedrock/mistral.mistral-large-2407-v1:0",
    name: "Mistral Large (Bedrock)",
    provider: "bedrock",
    capabilities: ["coding", "multilingual"],
  },
  {
    id: "bedrock/amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro (Bedrock)",
    provider: "bedrock",
    capabilities: ["multimodal", "fast"],
  },

  // --- Azure OpenAI ---
  // Deployment names are user-configured; these are common defaults
  {
    id: "azure/gpt-4o",
    name: "GPT-4o (Azure)",
    provider: "azure",
    capabilities: ["coding", "multimodal", "tool-use"],
  },
  {
    id: "azure/gpt-4o-mini",
    name: "GPT-4o Mini (Azure)",
    provider: "azure",
    capabilities: ["fast", "tool-use"],
  },
  {
    id: "azure/o3",
    name: "o3 (Azure)",
    provider: "azure",
    capabilities: ["reasoning", "coding"],
  },

  // --- Azure AI Foundry ---
  {
    id: "azure-foundry/DeepSeek-R1",
    name: "DeepSeek R1 (Azure Foundry)",
    provider: "azure-foundry",
    capabilities: ["reasoning", "coding", "open-source"],
  },
  {
    id: "azure-foundry/Meta-Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B (Azure Foundry)",
    provider: "azure-foundry",
    capabilities: ["coding", "open-source"],
  },
  {
    id: "azure-foundry/Mistral-Large-2411",
    name: "Mistral Large (Azure Foundry)",
    provider: "azure-foundry",
    capabilities: ["coding", "multilingual"],
  },
  {
    id: "azure-foundry/Phi-4",
    name: "Phi-4 (Azure Foundry)",
    provider: "azure-foundry",
    capabilities: ["reasoning", "efficient"],
  },
];

// ---------------------------------------------------------------------------
// Utility: check which providers have their env vars configured
// ---------------------------------------------------------------------------

export function getConfiguredProviders(): string[] {
  return PROVIDERS.filter((p) =>
    p.envVars.every((envVar) => !!process.env[envVar])
  ).map((p) => p.id);
}

export function getAvailableModels(): ModelInfo[] {
  const configured = new Set(getConfiguredProviders());
  return MODELS.filter((m) => configured.has(m.provider));
}
