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
  await expect(page.getByText("Informe o e-mail.")).toBeVisible();
  await expect(page.getByText("Informe a senha.")).toBeVisible();
});
