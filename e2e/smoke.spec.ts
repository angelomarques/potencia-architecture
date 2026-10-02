import { test, expect } from "@playwright/test";

test("home shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Potencia Stack")).toBeVisible();
});

test("health endpoint", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
});
