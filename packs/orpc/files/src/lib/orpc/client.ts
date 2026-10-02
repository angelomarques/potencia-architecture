"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "./router";

const link = new RPCLink({
  url: () =>
    typeof window === "undefined"
      ? "http://127.0.0.1:3000/api/rpc"
      : `${window.location.origin}/api/rpc`,
});

export const orpc: RouterClient<AppRouter> = createORPCClient(link);
