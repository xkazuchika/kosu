import { expect, test } from "@playwright/test";

test("fresh setup, monthly submission lifecycle, and supported reports remain deployable", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
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
  await expect(
    page.getByRole("heading", { name: "ダッシュボード", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("ログイン | kosu");
  await page.getByLabel("メールアドレス").fill("admin@example.com");
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/members");
  await page.getByRole("link", { name: "E2E Admin" }).click();
  await page.getByLabel("時間あたり原価（円）").fill("1000");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(
    page.getByRole("cell", { name: "1000", exact: true }),
  ).toBeVisible();

  await page.goto("/projects/new");
  await page.getByLabel("案件コード").fill("E2E-001");
  await page.getByLabel("案件名").fill("E2E入力確認");
  await page.getByLabel("タイプ").selectOption("internal");
  await page.getByLabel("工数予算（時間）").fill("120");
  await page.getByRole("button", { name: "作成する" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("link", { name: "E2E-001" }).click();
  await expect(page.getByText("120h", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "アサイン管理" }).click();
  await page
    .getByLabel("メンバー")
    .selectOption({ label: "E2E Admin (admin@example.com)" });
  await page.getByRole("button", { name: "アサイン" }).click();
  await expect(page.getByRole("cell", { name: "E2E Admin" })).toBeVisible();

  await page.goto("/work-logs/2026-08-12");
  await page.locator('form[data-entry-ready="true"]').waitFor();
  await page.getByLabel("実際の総稼働時間（0.25h 単位）").fill("8");
  await page
    .getByRole("combobox", { name: "案件 1" })
    .selectOption({ label: "E2E入力確認" });
  await page.getByRole("spinbutton", { name: "実績時間 1" }).fill("5");
  await page.getByRole("button", { name: "行を追加" }).click();
  await page
    .getByRole("combobox", { name: "案件 2" })
    .selectOption({ label: "E2E入力確認" });
  await page.getByRole("spinbutton", { name: "実績時間 2" }).fill("3");
  await expect(page.getByText("割当完了")).toBeVisible();
  await page.getByRole("button", { name: "実績をまとめて保存" }).click();
  await expect(page.getByText("実績工数 2 件を保存しました。")).toBeVisible();

  await page.goto("/work-logs/week?date=2026-08-12");
  await page.locator('form[data-entry-ready="true"]').waitFor();
  await expect(
    page.getByRole("heading", { level: 1, name: "週次工数実績入力" }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "2026-08-11 総稼働時間" })
    .fill("7.5");
  await page
    .getByRole("spinbutton", { name: "2026-08-11 実績時間 1" })
    .fill("7.5");
  await expect(page.getByText("7.5h / 完了")).toBeVisible();
  await page.getByRole("button", { name: "週の実績を保存" }).click();
  await expect(page.getByText(/日分の実績工数を保存しました。/)).toBeVisible();

  await page.goto("/period-locks?month=2026-07");
  await expect(
    page.getByRole("heading", { level: 1, name: "月次原価締め" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "レビューを開始して保護" }).click();
  await expect(page.getByText("2026-07 · レビュー中")).toBeVisible();

  await page.goto("/monthly-plans/admin?month=2026-07");
  await expect(
    page.getByText("2026-07 は「レビュー中」のため閲覧のみです。"),
  ).toBeVisible();

  await page.goto("/period-locks?month=2026-07");
  await page.getByLabel("再オープン理由（必須）").fill("E2E動作確認");
  await page.getByRole("button", { name: "再オープン" }).click();
  await expect(page.getByText("2026-07 · 未締め")).toBeVisible();

  await page.goto("/members/new");
  await page.locator('input[name="displayName"]').fill("E2E Member");
  await page.locator('input[name="email"]').fill("member@example.com");
  await page.locator('input[name="password"]').fill("password123");
  await page.getByRole("button", { name: "作成する" }).click();
  await expect(page).toHaveURL(/\/members$/);

  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByLabel("メールアドレス").fill("member@example.com");
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/work-logs/month?month=2026-09");
  await page.getByRole("button", { name: "この月の工数を提出" }).click();
  await expect(page.getByText("提出済み", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByLabel("メールアドレス").fill("admin@example.com");
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/work-logs/month?month=2026-09");
  await page.getByRole("button", { name: "この月の工数を提出" }).click();
  await expect(page.getByText("提出済み", { exact: true })).toBeVisible();

  const firstMonthlyTotal = page
    .locator('input[name="totalWorkingHours"]')
    .first();
  await firstMonthlyTotal.fill("1");
  await page.getByRole("button", { name: "総稼働時間を保存" }).click();
  await expect(page.getByText("下書き", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-09-01", { exact: true })).toBeVisible();
  await page.locator('input[name="totalWorkingHours"]').first().fill("0");
  await page.getByRole("button", { name: "総稼働時間を保存" }).click();
  await page.getByRole("button", { name: "この月の工数を提出" }).click();
  await expect(page.getByText("提出済み", { exact: true })).toBeVisible();

  await page.goto("/period-locks?month=2026-09");
  await expect(page.getByText("承認ブロッカー（0件）")).toBeVisible();
  await page.getByRole("button", { name: "レビューを開始して保護" }).click();
  await expect(page.getByText("2026-09 · レビュー中")).toBeVisible();
  await page.getByRole("button", { name: "完全性を再確認して承認" }).click();
  await expect(page.getByText("2026-09 · 承認済み")).toBeVisible();
  const approvedScreenshot = testInfo.outputPath("monthly-effort-approved.png");
  await page.screenshot({ path: approvedScreenshot });
  await testInfo.attach("monthly-effort-approved", {
    path: approvedScreenshot,
    contentType: "image/png",
  });

  await page.goto("/reports/planned-vs-actual");
  await expect(
    page.getByRole("heading", { level: 1, name: "予定工数対実績工数" }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);

  const obsoletePreviewResponse = await page.goto("/reports/resource-planning");
  expect(obsoletePreviewResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "エラー" })).toBeVisible();
});
