import { os } from "@orpc/server";
import { z } from "zod";

export const router = {
  health: os
    .input(z.object({}).optional())
    .handler(async () => ({ ok: true as const, service: "orpc" })),
  echo: os
    .input(z.object({ message: z.string().min(1).max(200) }))
    .handler(async ({ input }) => ({ message: input.message })),
};

export type AppRouter = typeof router;
