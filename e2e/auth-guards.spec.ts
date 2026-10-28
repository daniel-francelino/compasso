import { expect, test } from "@playwright/test";

test("a visitor without a session is sent to the login and keeps the requested page", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("the portal also requires a session", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fportal/);
});

test("the login form validates on the client before calling the server", async ({ page }) => {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Este campo é obrigatório")).toHaveCount(2);
});

for (const path of [
  "/admin/marketing/clients",
  "/admin/marketing/brands",
  "/admin/settings/users",
  "/admin/settings/roles",
  "/admin/settings/audit",
  "/admin/notifications",
  "/admin/library",
  "/admin/marketing",
  "/admin/marketing/content",
  "/admin/marketing/approvals",
  "/admin/marketing/content/00000000-0000-0000-0000-000000000001",
  "/admin/marketing/content/new",
  "/admin/marketing/approvals/00000000-0000-0000-0000-000000000001",
  "/admin/marketing/calendar",
  "/admin/marketing/brands/00000000-0000-0000-0000-000000000001/calendar",
]) {
  test(`${path} requires a session`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
  });
}

test("the media cleanup job refuses calls without the cron secret", async ({ request }) => {
  const response = await request.get("/api/cron/media-cleanup");
  expect(response.status()).toBe(401);
});

for (const path of [
  "/portal/brands/00000000-0000-0000-0000-000000000001",
  "/portal/brands/00000000-0000-0000-0000-000000000001/approvals",
  "/portal/brands/00000000-0000-0000-0000-000000000001/approvals/00000000-0000-0000-0000-000000000002",
  "/portal/brands/00000000-0000-0000-0000-000000000001/calendar",
  "/portal/notifications",
  "/portal/profile",
]) {
  test(`${path} requires a session and keeps the destination`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fportal/);
  });
}

test("the email outbox job refuses calls without the cron secret", async ({ request }) => {
  const response = await request.get("/api/cron/email-outbox");
  expect(response.status()).toBe(401);
});

test("the scheduled notifications job refuses calls without the cron secret", async ({
  request,
}) => {
  const response = await request.get("/api/cron/due-notifications");
  expect(response.status()).toBe(401);
});

test("with nothing readable the public site answers 503 and says it is in preparation", async ({
  request,
  page,
}) => {
  const response = await request.get("/servicos");
  expect(response.status()).toBe(503);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/servicos");
  await expect(page.getByRole("heading", { name: "Site em preparação" })).toBeVisible();
});

test("the home is the landing page of Rayana Vasconcelos and does not depend on published content", async ({
  request,
  page,
}) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua marca");
  await expect(page.getByRole("link", { name: "Vamos conversar" })).toBeVisible();
});

test("robots.txt blocks everything and the sitemap lists nothing while nothing is published", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("<url>");
});

for (const path of [
  "/admin/site",
  "/admin/site/pages",
  "/admin/site/pages/00000000-0000-0000-0000-000000000001",
  "/admin/site/services",
  "/admin/site/testimonials",
  "/admin/site/portfolio",
  "/admin/site/navigation",
  "/admin/site/settings",
  "/admin/site/seo",
  "/admin/site/redirects",
  "/admin/site/publications",
  "/admin/site/messages",
  "/admin/site/preview/00000000-0000-0000-0000-000000000001",
]) {
  test(`${path} requires a session`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
  });
}
