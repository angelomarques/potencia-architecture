import { eq } from "drizzle-orm";
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

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
  /** Typed Drizzle read of the signed-in user. Scaffold swaps this file out when auth or d1 is off. */
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
};

export type AppRouter = typeof router;
