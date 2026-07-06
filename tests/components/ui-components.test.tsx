import { render, screen } from "@testing-library/react";

import { Button } from "../../app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../app/components/ui/card";
import { Dialog } from "../../app/components/ui/dialog";
import { Field, Input } from "../../app/components/ui/form";
import { DataTable } from "../../app/components/ui/table";
import { Toast } from "../../app/components/ui/toast";

test("button exposes variants without losing native button behavior", () => {
  render(<Button variant="primary">保存する</Button>);

  expect(screen.getByRole("button", { name: "保存する" })).toHaveAttribute("type", "button");
});

test("card provides titled business content regions", () => {
  render(
    <Card>
      <CardHeader>
        <CardTitle>今月の状況</CardTitle>
      </CardHeader>
      <CardContent>予定 120h</CardContent>
    </Card>,
  );

  expect(screen.getByRole("heading", { name: "今月の状況" })).toBeInTheDocument();
  expect(screen.getByText("予定 120h")).toBeInTheDocument();
});

test("field wires labels and validation messages to inputs", () => {
  render(
    <Field error="0.25h 単位で入力してください" label="稼働時間">
      <Input aria-invalid name="hours" />
    </Field>,
  );

  expect(screen.getByLabelText("稼働時間")).toHaveAttribute("name", "hours");
  expect(screen.getByText("0.25h 単位で入力してください")).toBeInTheDocument();
});

test("data table renders accessible column headers and empty fallback", () => {
  render(<DataTable columns={["案件", "実績"]} emptyMessage="実績がありません" rows={[]} />);

  expect(screen.getByRole("columnheader", { name: "案件" })).toBeInTheDocument();
  expect(screen.getByText("実績がありません")).toBeInTheDocument();
});

test("dialog and toast expose accessible status content", () => {
  render(
    <>
      <Dialog description="この月をロックします" open title="月次ロック" />
      <Toast title="保存しました">入力内容を反映しました</Toast>
    </>,
  );

  expect(screen.getByRole("dialog", { name: "月次ロック" })).toHaveTextContent("この月をロックします");
  expect(screen.getByRole("status")).toHaveTextContent("保存しました");
});
