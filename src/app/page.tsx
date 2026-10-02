import { Button } from "@/components/ui/button";
import { env } from "@/env";

/**
 * Starter shell only — do not invent product UI here.
 * Replace this page when scaffolding a real app.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Potencia Stack</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {env.NEXT_PUBLIC_APP_NAME}
        </h1>
        <p className="text-muted-foreground">
          Reusable Next.js starter. Feature packs: auth, orpc, turnstile, d1, redis,
          posthog. Cloudflare workers only when cron/queues packs are enabled.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <a href="/api/health">Health</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://github.com/angelomarques/potencia-stack">Template repo</a>
        </Button>
      </div>
    </main>
  );
}
