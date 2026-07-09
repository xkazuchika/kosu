import { render, screen } from "@testing-library/react";

import { Badge } from "../../app/components/ui/badge";
import { EmptyState } from "../../app/components/ui/empty-state";
import { StatusMessage } from "../../app/components/ui/status-message";

test("badge renders accessible status text", () => {
  render(<Badge tone="warning">未割当あり</Badge>);

  expect(screen.getByText("未割当あり")).toBeInTheDocument();
});

test("empty state explains missing setup data", () => {
  render(<EmptyState actionLabel="案件を作成" description="案件がまだありません" title="案件未登録" />);

  expect(screen.getByRole("heading", { name: "案件未登録" })).toBeInTheDocument();
  expect(screen.getByText("案件がまだありません")).toBeInTheDocument();
  expect(screen.getByText("案件を作成")).toBeInTheDocument();
});

test("status message does not rely on color alone", () => {
  render(<StatusMessage tone="danger" title="保存できません">入力内容を確認してください</StatusMessage>);

  expect(screen.getByRole("alert")).toHaveTextContent("保存できません");
  expect(screen.getByText("入力内容を確認してください")).toBeInTheDocument();
});
