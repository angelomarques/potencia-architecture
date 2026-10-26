import { eq } from "drizzle-orm";
import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { Analytics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
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
  /** Typed Drizzle read of the signed-in user. Requires the auth + d1 packs. */
  account: {
    me: base.handler(async ({ context }) => {
      if (!context.headers) {
        throw new ORPCError("UNAUTHORIZED");
      }

      const session = await auth.api.getSession({
        headers: context.headers,
      });

      if (!session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      const rows = await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const row = rows[0];
      if (!row) {
        throw new ORPCError("NOT_FOUND");
      }

      return row;
    }),
  },
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
