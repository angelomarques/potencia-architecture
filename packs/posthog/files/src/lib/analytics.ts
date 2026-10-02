import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/env";

/**
 * Short event namespace for a shared PostHog project.
 * Template default is `app`. Scaffold / new-potencia-stack sets a unique
 * prefix per minted app from the package name (e.g. kingdom-movies → km).
 * Never hardcode product-specific prefixes like `lw` here.
 */
const EVENT_PREFIX = env.NEXT_PUBLIC_EVENT_PREFIX;

export class Analytics {
  private static client: PostHog | null = null;

  private constructor() {}

  private static getClient(): PostHog | null {
    const key = env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return null;
    if (!Analytics.client) {
      Analytics.client = new PostHog(key, {
        host: env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      });
    }
    return Analytics.client;
  }

  public static async track(params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    const client = Analytics.getClient();
    if (!client) return;
    client.capture({
      distinctId: params.distinctId,
      event: `${EVENT_PREFIX}_${params.event}`,
      properties: params.properties,
    });
  }

  public static async identify(params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    const client = Analytics.getClient();
    if (!client) return;
    client.identify({
      distinctId: params.distinctId,
      properties: params.properties,
    });
  }

  public static async shutdown(): Promise<void> {
    if (Analytics.client) {
      await Analytics.client.shutdown();
      Analytics.client = null;
    }
  }

  public static isInitialized(): boolean {
    return Analytics.client !== null;
  }
}
