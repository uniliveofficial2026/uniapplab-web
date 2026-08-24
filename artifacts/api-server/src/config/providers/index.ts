import { listProviderAdapters } from "../ProviderConfigService";
import { resolveServerSecret } from "../SecretResolver";
import { redactErrorMessage } from "../redaction";

export type ProviderHealthResult = {
  providerId: string;
  ok: boolean;
  reason?: string;
  checkedAt: string;
};

async function present(ref: string): Promise<boolean> {
  try {
    return Boolean(resolveServerSecret(ref));
  } catch (e) {
    redactErrorMessage(e instanceof Error ? e.message : "");
    return false;
  }
}

export const livekitAdapter = {
  providerId: "livekit",
  validatePublicConfig(config: unknown) {
    const url = String((config as { livekitUrl?: string })?.livekitUrl || "");
    if (url && !/^(https?|wss?):\/\//i.test(url)) throw new Error("invalid livekit url");
    return { livekitUrl: url };
  },
  async resolvePrivateConfig() {
    return {
      apiKeyPresent: await present("env://LIVEKIT_API_KEY"),
      apiSecretPresent: await present("env://LIVEKIT_API_SECRET"),
    };
  },
  async healthCheck(): Promise<ProviderHealthResult> {
    const priv = await this.resolvePrivateConfig();
    return {
      providerId: "livekit",
      ok: !priv.apiSecretPresent || (priv.apiKeyPresent && priv.apiSecretPresent),
      checkedAt: new Date().toISOString(),
    };
  },
  capabilities() {
    return { tokenMint: "server-only", ui: "view-model" };
  },
};

export const stripeAdapter = {
  providerId: "stripe",
  validatePublicConfig(config: unknown) {
    return { publishableKey: String((config as { stripePublishableKey?: string })?.stripePublishableKey || "") };
  },
  async resolvePrivateConfig() {
    return { secretPresent: await present("env://STRIPE_SECRET_KEY") };
  },
  async healthCheck(): Promise<ProviderHealthResult> {
    const priv = await this.resolvePrivateConfig();
    return { providerId: "stripe", ok: true, reason: priv.secretPresent ? undefined : "optional_unset", checkedAt: new Date().toISOString() };
  },
  capabilities() {
    return { checkout: "server-only", ui: "PurchaseViewModel" };
  },
};

export function registeredAdapters() {
  return listProviderAdapters();
}
