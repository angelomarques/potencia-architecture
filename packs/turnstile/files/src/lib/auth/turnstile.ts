import { env } from "@/env";
import { http } from "@/lib/http";

export async function verifyTurnstileToken(
  token: string,
  ip?: string | null,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing TURNSTILE_SECRET_KEY");
  }
  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  // siteverify is a POST but safe to retry: a token can only be redeemed once,
  // and a retry after a lost response just yields success=false (fail closed).
  const { data } = await http.post<{ success?: boolean }>(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, retry: 1 },
  );
  return Boolean(data.success);
}
