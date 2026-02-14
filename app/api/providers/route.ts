import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import {
  PROVIDERS,
  MODELS,
  getConfiguredProviders,
} from "@/lib/ai/providers";

/**
 * GET /api/providers
 *
 * Returns available AI providers and models.
 * Models are filtered to only include those with configured env vars.
 */
export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const configuredProviderIds = getConfiguredProviders();
  const configuredSet = new Set(configuredProviderIds);

  // Flat lists (kept for backward compatibility with agents page)
  const providersList = PROVIDERS.map((p) => ({
    ...p,
    configured: configuredSet.has(p.id),
  }));

  const modelsList = MODELS.map((m) => ({
    ...m,
    available: configuredSet.has(m.provider),
  }));

  // Grouped format for the model selector dropdown
  const providers = PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    available: configuredSet.has(p.id),
    models: MODELS.filter((m) => m.provider === p.id).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      capabilities: m.capabilities,
    })),
  }));

  return NextResponse.json({ providers, models: modelsList, providersList });
}
