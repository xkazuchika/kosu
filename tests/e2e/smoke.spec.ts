import { expect, test } from "@playwright/test";

test("fresh setup, login, and supported reports remain deployable", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.goto("/setup");
  await expect(page).toHaveTitle("初期セットアップ | kosu");
  await page.getByLabel("ワークスペース名").fill("E2E Workspace");
  await page.getByLabel("タイムゾーン").fill("Asia/Tokyo");
  await page.getByLabel("管理者氏名").fill("E2E Admin");
  await page.getByLabel("管理者メールアドレス").fill("admin@example.com");
  await page.getByLabel("管理者パスワード").fill("password123");
  await page.getByRole("button", { name: "セットアップを完了する" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "ダッシュボード", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("ログイン | kosu");
  await page.getByLabel("メールアドレス").fill("admin@example.com");
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/reports/planned-vs-actual");
  await expect(page.getByRole("heading", { level: 1, name: "予定工数対実績工数" })).toBeVisible();
  expect(browserErrors).toEqual([]);

  const obsoletePreviewResponse = await page.goto("/reports/resource-planning");
  expect(obsoletePreviewResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "エラー" })).toBeVisible();
});
