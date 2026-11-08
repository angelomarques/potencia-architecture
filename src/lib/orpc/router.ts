import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { captureServerEvent } from "@/lib/analytics";
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
      }),
  },
};

export type AppRouter = typeof router;
