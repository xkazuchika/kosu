import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseCsv } from "../../app/lib/csv";

async function downloadReport(page: Page, month: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV エクスポート" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`kosu-effort-report-${month}.csv`);
  const file = await download.path();
  expect(file).toBeTruthy();
  return parseCsv(await readFile(file!, "utf8"));
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(os.tmpdir(), `kosu-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (page.viewportSize()?.width === 390) {
    for (const table of await page.locator("table").all()) {
      const scrolled = await table.evaluate((element) => {
        const container = element.parentElement!;
        container.scrollLeft = container.scrollWidth;
        return container.scrollLeft;
      });
      expect(scrolled).toBeGreaterThan(0);
    }
    if (await page.locator("table").count()) {
      const scrolledFile = path.join(os.tmpdir(), `kosu-${name}-scrolled.png`);
      await page.screenshot({ path: scrolledFile, fullPage: true });
      await testInfo.attach(`${name}-scrolled`, {
        path: scrolledFile,
        contentType: "image/png",
      });
    }
  }
}

// Runs after the setup smoke flow so the single workspace remains isolated to
// one lifecycle test, without parallel tests racing to create the workspace.
export async function verifyReportHistory(page: Page, testInfo: TestInfo) {
  await page.goto("/members/new");
  await expect(page.getByLabel("操作権限")).toHaveValue("member");
  await page.getByLabel("氏名").fill("履歴担当者");
  await page.getByLabel("メールアドレス").fill("history@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("password123");
  await page.getByLabel("部署").fill("開発");
  await page.getByRole("button", { name: "作成する" }).click();
  await expect(
    page.getByRole("columnheader", { name: "操作権限" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "履歴担当者", exact: true }).click();
  await expect(page).toHaveURL(/\/members\/[^/?]+$/);
  const memberId = page.url().split("/").pop()!;
  await expect(
    page.getByText(/氏名・部署・操作権限の変更は、過去の工数レポートにも反映/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /無効化するとログインできなくなりますが、記録済みの実績は残り/,
    ),
  ).toBeVisible();

  const types = [
    ["billable", "請求対象"],
    ["internal", "社内作業"],
    ["non_billable", "非請求"],
  ] as const;
  let projectId = "";
  for (const [code, label] of types) {
    await page.goto("/projects/new");
    for (const [value, text] of types) {
      await expect(
        page
          .getByLabel("タイプ")
          .getByRole("option", { name: text, exact: true }),
      ).toHaveAttribute("value", value);
    }
    await page.getByLabel("案件コード").fill(`HISTORY-${code}`);
    await page.getByLabel("案件名").fill(`履歴案件-${label}`);
    await page.getByLabel("タイプ").selectOption(code);
    await page.getByRole("button", { name: "作成する" }).click();
    const row = page.getByRole("row").filter({
      has: page.getByRole("link", { name: `HISTORY-${code}`, exact: true }),
    });
    await expect(
      row.getByRole("cell", { name: label, exact: true }),
    ).toBeVisible();
    await row
      .getByRole("link", { name: `HISTORY-${code}`, exact: true })
      .click();
    await expect(page).toHaveURL(/\/projects\/[^/?]+$/);
    await expect(page.getByLabel("タイプ")).toHaveValue(code);
    if (code === "internal") projectId = page.url().split("/").pop()!;
  }

  await page.goto(`/projects/${projectId}/assignments`);
  await expect(
    page.getByRole("columnheader", { name: "案件内の役割" }),
  ).toBeVisible();
  for (const memberName of ["履歴担当者", "E2E Admin"]) {
    await page.getByLabel("メンバー").selectOption({
      label: `${memberName} (${memberName === "履歴担当者" ? "history" : "admin"}@example.com)`,
    });
    await page.getByLabel("案件内の役割", { exact: true }).fill("Engineer");
    await page.getByRole("button", { name: "アサイン", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: memberName, exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("履歴担当者の案件内の役割").fill("Lead");
  await page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", { name: "履歴担当者", exact: true }),
    })
    .getByRole("button", { name: "役割を保存" })
    .click();
  await expect(page.getByLabel("履歴担当者の案件内の役割")).toHaveValue("Lead");

  for (const [target, hours] of [
    [memberId, "3"],
    ["", "2"],
  ]) {
    const response = await page.goto(
      `/work-logs/2026-06-01${target ? `?memberId=${target}` : ""}`,
    );
    expect(response?.status()).toBe(200);
    await page.locator('form[data-entry-ready="true"]').waitFor();
    await page.getByLabel("実際の総稼働時間（0.25h 単位）").fill(hours);
    await page.getByLabel("案件 1", { exact: true }).selectOption(projectId);
    await page.getByLabel("実績時間 1", { exact: true }).fill(hours);
    await page
      .getByRole("button", { name: "実績をまとめて保存", exact: true })
      .click();
    await expect(page.getByText("実績工数 1 件を保存しました。")).toBeVisible();
  }
  await page.goto("/monthly-plans/admin?month=2026-06");
  const plan = page
    .locator("form")
    .filter({ has: page.locator('input[name="intent"][value="plan"]') });
  await plan.locator('select[name="memberId"]').selectOption(memberId);
  await plan.locator('select[name="projectId"]').selectOption(projectId);
  await plan.locator('input[name="assignmentRole"]').fill("Lead");
  await plan.locator('input[name="plannedHours"]').fill("4");
  await plan.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "月次配分一覧" })
      .getByText("4h", { exact: true })
      .first(),
  ).toBeVisible();

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/members/${memberId}`);
    await expect(page.getByLabel("操作権限")).toHaveValue("member");
    await expect(
      page.getByText(/無効化するとログインできなくなります/),
    ).toBeVisible();
    await capture(page, testInfo, `member-guidance-${viewport.width}`);
    await page.goto(`/projects/${projectId}`);
    await expect(
      page.getByText(
        /案件コード・名称・種別の変更は、過去の工数レポートにも反映/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/アーカイブすると新しい工数を入力できなくなります/),
    ).toBeVisible();
    await capture(page, testInfo, `project-guidance-${viewport.width}`);
  }
  await page.getByRole("button", { name: "アーカイブ", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto(`/members/${memberId}`);
  await page.getByRole("button", { name: "無効化", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/reports?month=2026-06");
    await expect(page).toHaveTitle("工数実績レポート | kosu");
    await page
      .getByLabel("メンバー", { exact: true })
      .selectOption({ label: "履歴担当者（無効）" });
    await page.getByLabel("案件", { exact: true }).selectOption(projectId);
    await page.getByLabel("部署", { exact: true }).fill("開発");
    await page.getByLabel("操作権限", { exact: true }).selectOption("member");
    await page.getByLabel("種別", { exact: true }).selectOption("internal");
    await page.getByRole("button", { name: "適用", exact: true }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("month") === "2026-06" &&
        url.searchParams.get("memberId") === memberId &&
        url.searchParams.get("projectId") === projectId,
    );
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(
      page.getByRole("cell", { name: "履歴担当者（無効）", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /履歴案件-社内作業.*終了（アーカイブ）/ }),
    ).toBeVisible();
    await expect(page.getByText("3h", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("2026-06 · 工数未確定", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /工数確定済みでも、当時の所属や分類が固定されるわけではありません/,
      ),
    ).toBeVisible();
    await capture(page, testInfo, `report-history-${viewport.width}`);
    // Editing every filter without applying must leave the download unchanged.
    await page.getByLabel("月", { exact: true }).fill("2026-05");
    await page.getByLabel("メンバー", { exact: true }).selectOption("");
    await page.getByLabel("部署", { exact: true }).fill("別部署");
    await page.getByLabel("操作権限", { exact: true }).selectOption("admin");
    await page.getByLabel("案件", { exact: true }).selectOption("");
    await page.getByLabel("種別", { exact: true }).selectOption("billable");
    const csv = await downloadReport(page, "2026-06");
    expect(csv[0]).toEqual([
      "日付",
      "メンバー",
      "部署",
      "権限",
      "案件コード",
      "案件名",
      "種別",
      "タスク",
      "時間",
      "備考",
    ]);
    expect(csv.slice(1)).toEqual([
      [
        "2026-06-01",
        "履歴担当者",
        "開発",
        "member",
        "HISTORY-internal",
        "履歴案件-社内作業",
        "internal",
        "",
        "3",
        "",
      ],
    ]);
    await page.getByLabel("月", { exact: true }).fill("2026-05");
    await page.getByLabel("メンバー", { exact: true }).selectOption(memberId);
    await page.getByLabel("部署", { exact: true }).fill("開発");
    await page.getByLabel("操作権限", { exact: true }).selectOption("member");
    await page.getByLabel("案件", { exact: true }).selectOption(projectId);
    await page.getByLabel("種別", { exact: true }).selectOption("internal");
    await page.getByRole("button", { name: "適用", exact: true }).click();
    await expect(page.getByText("0h", { exact: true })).toBeVisible();
    await expect(page.getByLabel("案件", { exact: true })).toHaveValue(
      projectId,
    );
    expect(await downloadReport(page, "2026-05")).toHaveLength(1);
    await page.goto("/reports/planned-vs-actual?month=2026-06");
    await expect(page).toHaveTitle("予定工数対実績工数 | kosu");
    await expect(
      page.getByRole("columnheader", { name: "案件内の役割" }),
    ).toBeVisible();
    const historical = page
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", {
          name: /履歴案件-社内作業.*終了（アーカイブ）/,
        }),
      })
      .filter({
        has: page.getByRole("cell", {
          name: "履歴担当者（無効）",
          exact: true,
        }),
      });
    await expect(
      historical.getByRole("cell", { name: "4h", exact: true }),
    ).toBeVisible();
    await expect(
      historical.getByRole("cell", { name: "3h", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("無効メンバー（配分対象外）", { exact: true }),
    ).toBeVisible();
    await capture(page, testInfo, `planned-history-${viewport.width}`);
  }
}
