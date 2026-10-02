import { NextResponse } from "next/server";
import { env } from "@/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: env.NEXT_PUBLIC_APP_NAME,
    nodeEnv: env.NODE_ENV,
  });
}
