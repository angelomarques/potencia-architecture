import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { Analytics } from "@/lib/analytics";
import { helpCenterInputSchema } from "@/lib/validation/help-center";

export interface ORPCContext {
  headers?: Headers;
}

const base = os.$context<ORPCContext>();

export const router = {
  health: os
    .input(z.object({}).optional())
    .handler(async () => ({ ok: true as const, service: "orpc" })),
  echo: os
    .input(z.object({ message: z.string().min(1).max(200) }))
    .handler(async ({ input }) => ({ message: input.message })),
  support: {
    helpCenterSubmit: base
      .input(helpCenterInputSchema)
      .handler(async ({ input, context }) => {
        if (!context.headers) {
          throw new ORPCError("UNAUTHORIZED");
        }

        const session = await auth.api.getSession({
          headers: context.headers,
        });

        if (!session?.user) {
          throw new ORPCError("UNAUTHORIZED");
        }

        const user = session.user;

        await Analytics.track({
          distinctId: user.id,
          event: "help_center_submitted",
          properties: {
            email: input.email,
            message: input.message,
            messageLength: input.message.length,
            accountEmail: user.email,
          },
        });

        await Analytics.shutdown();

        return { ok: true };
      }),
  },
};

export type AppRouter = typeof router;
