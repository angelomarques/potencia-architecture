import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  POSTHOG_FLUSH_TIMEOUT_MS,
  captureServerEvent,
  flushWithTimeout,
  resetAnalyticsForTests,
  scheduleAfterResponse,
  setAnalyticsClientForTests,
  setAnalyticsSchedulerForTests,
} from "./analytics";

afterEach(() => {
  resetAnalyticsForTests();
});

function stubConsoleError() {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "));
  };
  return {
    lines,
    restore() {
      console.error = original;
    },
  };
}

describe("server PostHog flush", () => {
  test("captureServerEvent returns before the flush, and a hanging flush times out", async () => {
    const captured: Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }> = [];
    const queued: Array<() => void | Promise<void>> = [];
    let flushStarted = false;

    setAnalyticsClientForTests({
      capture(message) {
        captured.push({
          distinctId: message.distinctId,
          event: message.event,
          properties: message.properties as Record<string, unknown> | undefined,
        });
      },
      identify() {},
      flush() {
        flushStarted = true;
        return new Promise(() => {});
      },
    });
    setAnalyticsSchedulerForTests({
      after(task) {
        queued.push(task);
      },
      waitUntil() {
        throw new Error("waitUntil should not run when after() accepts the task");
      },
    });

    const logs = stubConsoleError();
    try {
      const started = Date.now();

      async function handler() {
        captureServerEvent("help_center_submitted", {
          distinctId: "user_1",
          properties: {
            email: "a@b.co",
            message: "hi",
            accountEmail: "a@b.co",
          },
        });
        return { ok: true as const, flushStarted };
      }

      const response = await handler();
      const responseMs = Date.now() - started;

      assert.deepEqual(response, { ok: true, flushStarted: false });
      assert.ok(responseMs < POSTHOG_FLUSH_TIMEOUT_MS, `handler waited ${responseMs}ms for PostHog`);
      assert.equal(queued.length, 1);
      assert.equal(captured[0]?.event, "app_help_center_submitted");
      assert.equal(captured[0]?.distinctId, "user_1");
      assert.equal(captured[0]?.properties?.accountEmail, "a@b.co");

      const flushStartedAt = Date.now();
      await queued[0]!();
      const flushMs = Date.now() - flushStartedAt;

      assert.equal(flushStarted, true);
      assert.ok(
        flushMs >= POSTHOG_FLUSH_TIMEOUT_MS - 50,
        `flush returned early (${flushMs}ms)`,
      );
      assert.ok(flushMs < POSTHOG_FLUSH_TIMEOUT_MS + 2_000, `flush hung past the cap (${flushMs}ms)`);
      assert.ok(
        logs.lines.some((line) => line.includes("PostHog flush timed out")),
        `expected a timeout log, got ${JSON.stringify(logs.lines)}`,
      );
    } finally {
      logs.restore();
    }
  });

  test("flushWithTimeout swallows a rejected flush", async () => {
    const logs = stubConsoleError();
    try {
      const started = Date.now();
      await flushWithTimeout(() => Promise.reject(new Error("ingest down")), 5_000);
      const elapsed = Date.now() - started;
      assert.ok(elapsed < 1_000, `rejection blocked for ${elapsed}ms`);
      assert.ok(logs.lines.some((line) => line.includes("ingest down")));
    } finally {
      logs.restore();
    }
  });

  test("scheduleAfterResponse falls back to waitUntil and does not await it", async () => {
    let finished = false;
    let observed: Promise<unknown> | undefined;

    scheduleAfterResponse(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            finished = true;
            resolve();
          }, 40);
        }),
      {
        after() {
          throw new Error("after unavailable");
        },
        waitUntil(promise) {
          observed = promise;
        },
      },
    );

    assert.ok(observed, "waitUntil was not called");
    assert.equal(finished, false);
    await observed;
    assert.equal(finished, true);
  });
});
