import { render, screen } from "@testing-library/react";

import { AppShell } from "../../app/components/app-shell";
import { LoadingState } from "../../app/components/loading-state";

test("member navigation hides administrator-only links", () => {
  render(
    <AppShell role="member" userName="田中">
      <p>本文</p>
    </AppShell>,
  );

  expect(screen.getAllByRole("link", { name: "ダッシュボード" }).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Actual").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Plan").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Analyze").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "日別工数実績入力" })[0]).toHaveAttribute("href", "/work-logs");
  expect(screen.getAllByRole("link", { name: "月別総稼働時間入力" })[0]).toHaveAttribute("href", "/work-logs/month");
  expect(screen.getAllByRole("link", { name: "日別予定工数入力" })[0]).toHaveAttribute("href", "/daily-plans");
  expect(screen.getAllByRole("link", { name: "自己アサイン" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "予定工数対実績工数" }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "メンバー" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "インポート" })).not.toBeInTheDocument();
});

test("administrator navigation shows management links", () => {
  render(
    <AppShell currentPath="/daily-plans" role="admin" userName="管理者">
      <p>本文</p>
    </AppShell>,
  );

  expect(screen.getAllByRole("link", { name: "メンバー" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "月次予定工数入力" })[0]).toHaveAttribute("href", "/monthly-plans/admin");
  expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "日別予定工数入力" })[0]).toHaveAttribute("href", "/daily-plans");
  expect(screen.getAllByRole("link", { name: "日別予定工数入力" })[0]).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByRole("link", { name: "案件管理" })[0]).toHaveAttribute("href", "/projects");
  expect(screen.getAllByRole("link", { name: "自己アサイン" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "予定工数対実績工数" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "インポート" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("navigation", { name: "メインナビゲーション" })).toHaveClass("overflow-y-auto");
  expect(screen.getByText("Menu")).toBeInTheDocument();
  expect(screen.queryByText(/2026-07/)).not.toBeInTheDocument();
  expect(screen.getAllByText("kosu").length).toBeGreaterThan(0);
  expect(screen.getByText("管理者")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
});

test("loading state announces progress", () => {
  render(<LoadingState label="読み込み中" />);

  expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
});
