import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, test } from "vitest";

import { DailyEntryEditor } from "../../app/routes/work-logs.$date";
import { WeeklyEntryEditor } from "../../app/routes/work-logs.week";
import { listWeekDates } from "../../app/lib/time";

const projects = [
  { id: "project-a", name: "案件A", isArchived: false },
  { id: "project-b", name: "案件B", isArchived: false },
];
const tasks = [
  {
    id: "task-a",
    projectId: "project-a",
    name: "設計",
    isArchived: false,
  },
  {
    id: "task-b",
    projectId: "project-b",
    name: "実装",
    isArchived: false,
  },
];

function renderDaily(total = "8", allocated = "5") {
  return renderInRouter(
    <DailyEntryEditor
      activeTasks={tasks}
      assignedProjects={projects}
      initialDraft={{
        totalWorkingHours: total,
        rows: [
          {
            allocationId: "",
            projectId: "project-a",
            taskId: "task-a",
            allocatedHours: allocated,
            note: "",
          },
        ],
      }}
      isLocked={false}
      projectEffortContext={{}}
      referencedOnlyProjectIds={[]}
    />,
  );
}

function renderInRouter(element: ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }]);
  return render(<RouterProvider router={router} />);
}

describe("daily effort editor", () => {
  test("adds and removes rows and filters tasks by the selected project", () => {
    renderDaily();

    expect(screen.getByRole("option", { name: "設計" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "実装" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "案件 1" }), {
      target: { value: "project-b" },
    });
    const taskSelect = screen.getByRole("combobox", { name: "タスク 1" });
    expect(
      within(taskSelect).getByRole("option", { name: "実装" }),
    ).toBeInTheDocument();
    expect(
      within(taskSelect).queryByRole("option", { name: "設計" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
    expect(
      screen.getByRole("combobox", { name: "案件 2" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "行を削除" })[1]);
    expect(
      screen.queryByRole("combobox", { name: "案件 2" }),
    ).not.toBeInTheDocument();
  });

  test.each([
    ["5", "5", "割当完了"],
    ["8", "5", "未割当 3h"],
    ["9.5", "10", "超過 0.5h"],
  ])(
    "shows the live balance for total %sh and allocation %sh",
    (total, allocated, message) => {
      renderDaily(total, allocated);
      expect(screen.getByText(message)).toBeInTheDocument();
    },
  );

  test("assigns all remaining time to a row", () => {
    renderDaily("8", "5");
    fireEvent.click(screen.getByRole("button", { name: "残りを全部" }));
    expect(screen.getByRole("spinbutton", { name: "実績時間 1" })).toHaveValue(
      8,
    );
    expect(screen.getByText("割当完了")).toBeInTheDocument();
  });
});

describe("weekly effort editor", () => {
  test("edits a representative week with reusable rows and live daily balances", () => {
    const dates = listWeekDates("2026-07-08");
    const { container } = renderInRouter(
      <WeeklyEntryEditor
        draft={{
          weekDate: dates[0],
          dates,
          totalWorkingHours: { [dates[0]]: "8" },
          rows: [
            {
              key: "existing",
              projectId: "project-a",
              taskId: "task-a",
              note: "",
              allocationIds: {},
              hours: { [dates[0]]: "5" },
            },
          ],
        }}
        isLocked={false}
        projects={projects}
        referencedOnlyProjectIds={[]}
        tasks={tasks}
      />,
    );

    expect(screen.getByText("5h / 残3h")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: `${dates[0]} 実績時間 1`,
      }),
      { target: { value: "8" } },
    );
    expect(screen.getByText("8h / 完了")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
    expect(
      screen.getByRole("combobox", { name: "案件 2" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "案件 2" }), {
      target: { value: "project-b" },
    });
    expect(
      within(screen.getByRole("combobox", { name: "タスク 2" })).getByRole(
        "option",
        { name: "実装" },
      ),
    ).toBeInTheDocument();
    expect(
      (container.querySelector('input[name="weeklyDraft"]') as HTMLInputElement)
        .value,
    ).toContain("project-b");
  });
});
