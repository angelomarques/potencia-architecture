export interface Env {
  CRON_SECRET?: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log("[cf-cron] tick", { hasSecret: Boolean(env.CRON_SECRET) });
    // Invoke your Vercel app or D1 maintenance here.
  },
};
