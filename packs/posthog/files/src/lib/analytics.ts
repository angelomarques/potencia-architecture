import "server-only";

import { after } from "next/server";
import { waitUntil } from "@vercel/functions";
import { PostHog } from "posthog-node";

import { env } from "@/env";

/**
 * Short event namespace for a shared PostHog project.
 * Template default is `app`. Scaffold / new-potencia-stack sets a unique
 * prefix per minted app from the package name (e.g. kingdom-movies → km).
 * Never hardcode product-specific prefixes like `lw` here.
 */
const EVENT_PREFIX = env.NEXT_PUBLIC_EVENT_PREFIX;

/**
 * Hard cap for one PostHog flush on a serverless invocation.
 * Long enough for a normal ingest round trip, short enough that a hung
 * PostHog cannot hold the function open until the platform kills it.
 */
export const POSTHOG_FLUSH_TIMEOUT_MS = 2_500;

type ServerPostHog = Pick<PostHog, "capture" | "identify" | "flush">;

export type ServerEventProps = {
  /** Stable PostHog distinct id. Falls back to `"server"` when the caller has no user. */
  distinctId?: string;
  properties?: Record<string, unknown>;
};

export type ResponseSchedulers = {
  after?: (task: () => void | Promise<void>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

/**
 * One client per warm instance. Closing it after every capture forces the
 * next request to construct a new one and is what made handlers wait on PostHog.
 */
let client: PostHog | null = null;

/** @internal Set by tests so capture can run without a network client. */
let clientOverride: ServerPostHog | null | undefined;

/** @internal Set by tests to observe after()/waitUntil without a Next.js request. */
let schedulerOverride: ResponseSchedulers | undefined;

function getClient(): ServerPostHog | null {
  if (clientOverride !== undefined) return clientOverride;
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // Serverless queue: send on the first event. A 10s interval never fires
      // once the isolate freezes, and a batch of 20 would wait for traffic
      // this instance will not see. Delivery still requires the explicit flush
      // scheduled below — capture() alone does not keep the invocation alive.
      flushAt: 1,
      flushInterval: 0,
      // One attempt, aborted on the same budget as flushWithTimeout.
      // The SDK default is 3 retries spaced 3s apart, which outlives the cap.
      requestTimeout: POSTHOG_FLUSH_TIMEOUT_MS,
      fetchRetryCount: 0,
    });
  }
  return client;
}

/**
 * Flush and give up after `timeoutMs`. Resolves either way.
 * A rejected or hung PostHog call is logged and swallowed so the invocation
 * ends cleanly.
 */
export async function flushWithTimeout(
  flush: () => Promise<unknown>,
  timeoutMs = POSTHOG_FLUSH_TIMEOUT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[analytics] PostHog flush timed out after ${timeoutMs}ms`);
      resolve();
    }, timeoutMs);
  });

  // Attach catch before the race so a flush that rejects after the timeout
  // cannot surface as an unhandled rejection.
  const pending = Promise.resolve()
    .then(() => flush())
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error("[analytics] PostHog flush failed", error);
    });

  try {
    await Promise.race([pending, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Run `task` after the response when Next.js `after()` is in scope.
 * `after` throws outside a request, and the Vercel `waitUntil` fallback
 * keeps the invocation alive for the same promise. The caller does not wait.
 */
export function scheduleAfterResponse(
  task: () => Promise<void>,
  schedulers?: ResponseSchedulers,
): void {
  const resolved = schedulers ?? schedulerOverride;
  const run = () => task();

  try {
    if (resolved?.after) {
      // Return the promise so the scheduler awaits it after the response.
      resolved.after(run);
    } else {
      after(run);
    }
    return;
  } catch {
    // `after` throws outside a Next.js request scope.
  }

  try {
    if (resolved?.waitUntil) {
      resolved.waitUntil(run());
    } else {
      waitUntil(run());
    }
  } catch (error) {
    console.error(
      "[analytics] could not schedule PostHog flush; after() and waitUntil were unavailable",
      error,
    );
  }
}

function scheduleFlush(ph: ServerPostHog): void {
  scheduleAfterResponse(() => flushWithTimeout(() => ph.flush()));
}

/**
 * Capture one server event and schedule its flush after the response.
 * `event` is the unprefixed name; `NEXT_PUBLIC_EVENT_PREFIX` is applied here.
 * Record the product action once — a submission or signup, not each query it ran.
 */
export function captureServerEvent(event: string, props?: ServerEventProps): void {
  const ph = getClient();
  if (!ph) return;
  ph.capture({
    distinctId: props?.distinctId ?? "server",
    event: `${EVENT_PREFIX}_${event}`,
    properties: props?.properties,
  });
  scheduleFlush(ph);
}

export class Analytics {
  private constructor() {}

  public static async track(params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    captureServerEvent(params.event, {
      distinctId: params.distinctId,
      properties: params.properties,
    });
  }

  public static async identify(params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    const ph = getClient();
    if (!ph) return;
    ph.identify({
      distinctId: params.distinctId,
      properties: params.properties,
    });
    scheduleFlush(ph);
  }

  public static isInitialized(): boolean {
    return client !== null;
  }
}

/** @internal */
export function setAnalyticsClientForTests(fake: ServerPostHog | null): void {
  clientOverride = fake;
}

/** @internal */
export function setAnalyticsSchedulerForTests(next: ResponseSchedulers | undefined): void {
  schedulerOverride = next;
}

/** @internal */
export function resetAnalyticsForTests(): void {
  clientOverride = undefined;
  schedulerOverride = undefined;
  client = null;
}
