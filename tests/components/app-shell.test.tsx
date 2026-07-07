import { render, screen } from "@testing-library/react";

import { AppShell } from "../../app/components/app-shell";
import { LoadingState } from "../../app/components/loading-state";

test("member navigation hides administrator-only links", () => {
  render(
    <AppShell role="member" currentMonth="2026-07" userName="田中" title="ダッシュボード">
      <p>本文</p>
    </AppShell>,
  );

  expect(screen.getByRole("link", { name: "ダッシュボード" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "工数入力" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "自己アサイン" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "予定対実績" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "メンバー" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "インポート" })).not.toBeInTheDocument();
});

test("administrator navigation shows management links", () => {
  render(
    <AppShell role="admin" currentMonth="2026-07" userName="管理者" title="管理">
      <p>本文</p>
    </AppShell>,
  );

  expect(screen.getByRole("link", { name: "メンバー" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "月次予定入力" })).toHaveAttribute("href", "/monthly-plans/admin");
  expect(screen.getByRole("link", { name: "自己アサイン" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "予定対実績" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "インポート" })).toBeInTheDocument();
  expect(screen.getByText(/2026-07/)).toBeInTheDocument();
  expect(screen.getByText("管理者")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
});

test("loading state announces progress", () => {
  render(<LoadingState label="読み込み中" />);

  expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
});
