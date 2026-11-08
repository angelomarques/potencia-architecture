---
name: posthog-server
description: Server-side PostHog in Potencia apps. Use when capturing server events, editing src/lib/analytics.ts, the posthog pack, or wiring oRPC procedures and route handlers. Covers the singleton posthog-node client, EVENT_PREFIX, and a non-blocking flush via after()/waitUntil.
---

# posthog-server

Server captures live in `src/lib/analytics.ts` (and the copy the scaffolder ships, `packs/posthog/files/src/lib/analytics.ts`). Browser `posthog-js` stays in `src/components/analytics/posthog-provider.tsx`.

## Why the flush is scheduled after the response

Vercel freezes the instance once the response is sent. `posthog-node` queues events in memory and delivers them on `flush()`. With nothing keeping the invocation alive, that queue is discarded and the event never arrives.

Awaiting `flush()` or `shutdown()` inside the handler does send the event, and it also holds the HTTP response open for the PostHog round trip. A slow or stuck ingest then hangs the request. `shutdown()` also closes the client, so the next request on a warm instance builds a new one.

`after()` from `next/server` runs a callback after the response is flushed and tells the platform to keep the invocation alive until that callback's promise settles. The user is not waiting on PostHog. Where `after` is unavailable it throws (there is no request scope); the helper catches that and passes the same promise to `waitUntil` from `@vercel/functions`, which is the Vercel equivalent.

`flushWithTimeout` wraps `client.flush()` in `Promise.race` against `POSTHOG_FLUSH_TIMEOUT_MS` (2.5s). The losing flush is logged (`[analytics] PostHog flush timed out` / `PostHog flush failed`) and the promise resolves, so a bad ingest cannot hang the invocation or reject the `after` task. The client sets `requestTimeout` to the same budget and `fetchRetryCount: 0` because the SDK's default is three retries, 3s apart.

The client is a module singleton (`flushAt: 1`, `flushInterval: 0`): the first event is eligible to send immediately, and there is no 10s timer that a frozen isolate will never reach. The explicit flush is still required so the platform tracks the in-flight request.

## How to capture

```ts
import { captureServerEvent } from "@/lib/analytics";

captureServerEvent("signup_completed", {
  distinctId: user.id,
  properties: { plan: "free" },
});
```

`event` is unprefixed. The helper sends `${NEXT_PUBLIC_EVENT_PREFIX}_${event}`. `distinctId` defaults to `"server"` when the caller has no user; pass the user id when there is one.

Missing `NEXT_PUBLIC_POSTHOG_KEY` makes the helper a no-op.

`Analytics.track` and `Analytics.identify` call the same client and schedule the same flush. Prefer `captureServerEvent` at new call sites.

Record the product action once. A help submission is one `help_center_submitted` even if the handler reads or writes several rows. Per-query events drown the project and are not how potencia-dashboard groups anything.

### oRPC procedure

`src/lib/orpc/router.ts` (`support.helpCenterSubmit`):

```ts
captureServerEvent("help_center_submitted", {
  distinctId: user.id,
  properties: {
    email: input.email,
    message: input.message,
    messageLength: input.message.length,
    accountEmail: user.email,
  },
});
return { ok: true };
```

`after()` sees the request because the procedure runs inside the `/api/rpc` route handler, on the same async context. The return value is the response; the flush is the `after` task.

### Route handler

```ts
import { captureServerEvent } from "@/lib/analytics";

export async function POST() {
  captureServerEvent("signup_completed", {
    distinctId: user.id,
    properties: { plan: "free" },
  });
  return Response.json({ ok: true });
}
```

Call `captureServerEvent` before returning. `after()` has to be registered while the request is still active.

## Checks

- `pnpm test:analytics` — the handler returns before the queued flush runs, and a flush that never resolves settles at the timeout.
- `pnpm doctor` — `captureServerEvent`, `flushWithTimeout`, `after`, `waitUntil`, pack file in sync with `src/lib/analytics.ts`.
- `posthog-node`'s own HTTP is an SDK exception (`.cursor/rules/http-axios.mdc`). Application code still uses `@/lib/http`.
