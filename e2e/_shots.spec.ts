import { test } from "@playwright/test";

const out =
  "C:/Users/DANIEL~1.FRA/AppData/Local/Temp/claude/c--Users-daniel-francelino-Desktop-projects-study-lost-ui/b4d23aca-8924-487b-a7e5-bdced036c140/scratchpad";

for (const [name, path] of [
  ["login", "/admin/login"],
  ["recover", "/admin/recover-password"],
  ["confirm", "/admin/confirm-email"],
  ["callback", "/admin/callback"],
  ["pending", "/admin/pending"],
]) {
  test(`shot ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${name}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({ path: `${out}/${name}-mobile.png` });
  });
}

test("login validation", async ({ page }) => {
  await page.goto("/admin/login");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.screenshot({ path: `${out}/login-errors.png` });
});
