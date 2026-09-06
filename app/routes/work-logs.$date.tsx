import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs.$date";

import {
  MonthlyCloseReadOnlyNotice,
  MonthlyCloseStatusBadge,
} from "~/components/monthly-close-status";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import type { KosuDatabase } from "~/db/client";
import {
  createDailyWorkLog,
  findDailyWorkLogById,
  findDailyWorkLogByMemberAndDate,
  updateDailyWorkLog,
} from "~/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  deleteEffortAllocation,
  findAllocationById,
  listAllocationsByWorkLog,
  listRecentlyUsedProjectIdsByMember,
  updateEffortAllocation,
} from "~/db/repositories/effort-allocations";
import {
  findMemberById,
  withoutMemberFinancials,
} from "~/db/repositories/members";
import {
  findActiveAssignment,
  listActiveAssignmentsByMember,
} from "~/db/repositories/project-assignments";
import {
  findProjectById,
  withoutProjectFinancials,
} from "~/db/repositories/projects";
import {
  findTaskById,
  listActiveTasksByProject,
} from "~/db/repositories/tasks";
import { getSessionMember } from "~/services/auth";
import { logRouteError } from "~/lib/log";
import {
  getWeekdayLabel,
  isSaturdayDate,
  isSundayDate,
  isValidQuarterHour,
} from "~/lib/time";
import { getMonthlyCostCloseState } from "~/services/monthly-cost-close";
import { requireUnlockedMonth } from "~/services/period-lock";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({
  request,
  params,
}: {
  request: Request;
  params: { date: string };
}) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const url = new URL(request.url);
    const memberIdParam = url.searchParams.get("memberId");
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const isAdmin = currentMember.role === "admin";
    const { today } = getWorkspaceCalendarContext(db);
    const targetMemberId =
      memberIdParam && isAdmin ? memberIdParam : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    const workDate = params.date;
    const month = workDate.slice(0, 7);
    const workLog = findDailyWorkLogByMemberAndDate(
      db,
      targetMemberId,
      workDate,
    );
    const allocations = workLog ? listAllocationsByWorkLog(db, workLog.id) : [];
    const assignedProjectRecords = listActiveAssignmentsByMember(
      db,
      targetMemberId,
    )
      .map((a) => findProjectById(db, a.projectId))
      .filter(
        (p): p is NonNullable<typeof p> => p !== undefined && !p.isArchived,
      );
    const assignableProjectIds = new Set(
      assignedProjectRecords.map((project) => project.id),
    );
    const referencedProjectRecords = [
      ...new Set(allocations.map((allocation) => allocation.projectId)),
    ]
      .filter((projectId) => !assignableProjectIds.has(projectId))
      .map((projectId) => findProjectById(db, projectId))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    const selectableProjectRecords = [
      ...assignedProjectRecords,
      ...referencedProjectRecords,
    ];
    const activeTasks = selectableProjectRecords.flatMap((project) =>
      listActiveTasksByProject(db, project.id).map((task) => ({
        ...task,
        projectName: project.name,
      })),
    );
    const activeTaskIds = new Set(activeTasks.map((task) => task.id));
    const projectNameById = new Map(
      selectableProjectRecords.map((project) => [project.id, project.name]),
    );
    const referencedTasks = [
      ...new Set(allocations.map((allocation) => allocation.taskId)),
    ]
      .filter(
        (taskId): taskId is string =>
          taskId !== null && !activeTaskIds.has(taskId),
      )
      .map((taskId) => findTaskById(db, taskId))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map((task) => ({
        ...task,
        projectName: projectNameById.get(task.projectId) ?? "",
      }));
    const selectableTasks = [...activeTasks, ...referencedTasks];
    const recentlyUsedProjectIds = listRecentlyUsedProjectIdsByMember(
      db,
      targetMemberId,
      addDays(workDate, -60),
    );
    const recentOrder = new Map(
      recentlyUsedProjectIds.map((projectId, index) => [projectId, index]),
    );
    const orderedProjectRecords = [...selectableProjectRecords].sort((a, b) => {
      const aRecent = recentOrder.has(a.id);
      const bRecent = recentOrder.has(b.id);

      if (aRecent && bRecent) {
        return (recentOrder.get(a.id) ?? 0) - (recentOrder.get(b.id) ?? 0);
      }

      if (aRecent) return -1;
      if (bRecent) return 1;

      return 0;
    });
    const assignedProjects = isAdmin
      ? orderedProjectRecords
      : orderedProjectRecords.map(withoutProjectFinancials);
    const referencedOnlyProjectIds = referencedProjectRecords.map(
      (project) => project.id,
    );

    const closeState = getMonthlyCostCloseState(db, month);

    return {
      currentMemberId: currentMember.id,
      today,
      workDate,
      month,
      workLog,
      allocations,
      assignedProjects,
      activeTasks: selectableTasks,
      referencedOnlyProjectIds,
      isAdmin,
      targetMember: withoutMemberFinancials(targetMember),
      isLocked: closeState.isProtected,
      closeStatus: closeState.status,
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const url = new URL(request.url);
    const memberIdParam = url.searchParams.get("memberId");
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const isAdmin = currentMember.role === "admin";
    const targetMemberId =
      memberIdParam && isAdmin ? memberIdParam : currentMember.id;

    if (targetMemberId !== currentMember.id && !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const workDate = params.date;
    const month = workDate.slice(0, 7);
    const formData = await request.formData();
    const deleteAllocationId = String(
      formData.get("deleteAllocationId") ?? "",
    ).trim();
    const intent = String(formData.get("intent") ?? "").trim();

    if (deleteAllocationId) {
      const allocation = findAllocationById(db, deleteAllocationId);
      const allocationLog = allocation
        ? findDailyWorkLogById(db, allocation.dailyWorkLogId)
        : undefined;

      if (
        !isOwnedAllocationOnDate(
          allocation,
          allocationLog,
          targetMemberId,
          workDate,
        )
      ) {
        throw new Response("Not found", { status: 404 });
      }

      requireUnlockedMonth(db, allocationLog!.workDate.slice(0, 7));
      deleteEffortAllocation(db, deleteAllocationId, new Date().toISOString());

      return { success: "実績工数を 1 件削除しました。" };
    }

    if (intent === "saveWorkLog") {
      requireUnlockedMonth(db, month);

      const totalWorkingHours = Number(
        String(formData.get("totalWorkingHours") ?? "").trim(),
      );

      if (!isValidQuarterHour(totalWorkingHours)) {
        return { error: "総稼働時間は 0.25h 単位で入力してください。" };
      }

      const existing = findDailyWorkLogByMemberAndDate(
        db,
        targetMemberId,
        workDate,
      );

      if (existing) {
        updateDailyWorkLog(db, existing.id, { totalWorkingHours });
      } else {
        createDailyWorkLog(db, {
          memberId: targetMemberId,
          workDate,
          totalWorkingHours,
        });
      }

      return { success: "総稼働時間を保存しました。" };
    }

    if (intent === "copyPrevious") {
      requireUnlockedMonth(db, month);

      return copyPreviousDayEffort(db, targetMemberId, workDate);
    }

    if (intent === "saveDay") {
      requireUnlockedMonth(db, month);

      return saveDayEffort(db, targetMemberId, workDate, formData);
    }

    return { error: "不明な操作です。" };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    logRouteError("work-logs.$date", error);
    return { error: "保存に失敗しました。" };
  } finally {
    sqlite.close();
  }
};

type DailyEntryRow = {
  allocationId: string;
  projectId: string;
  taskId: string;
  hoursRaw: string;
  note: string;
};

type DailyEntryResult = { success?: string; error?: string };

type EffortAllocationRow = NonNullable<ReturnType<typeof findAllocationById>>;
type DailyWorkLogRow = NonNullable<ReturnType<typeof findDailyWorkLogById>>;

function isOwnedAllocationOnDate(
  allocation: EffortAllocationRow | undefined,
  allocationLog: DailyWorkLogRow | undefined,
  memberId: string,
  workDate: string,
) {
  return Boolean(
    allocation &&
    !allocation.deletedAt &&
    allocationLog &&
    !allocationLog.deletedAt &&
    allocationLog.memberId === memberId &&
    allocationLog.workDate === workDate,
  );
}

function parseDailyEntryRows(formData: FormData): DailyEntryRow[] {
  const allocationIds = formData.getAll("allocationId").map(String);
  const projectIds = formData.getAll("projectId").map(String);
  const taskIds = formData.getAll("taskId").map(String);
  const hoursValues = formData.getAll("allocatedHours").map(String);
  const notes = formData.getAll("note").map(String);
  const rowCount = Math.max(
    allocationIds.length,
    projectIds.length,
    hoursValues.length,
  );
  const rows: DailyEntryRow[] = [];

  for (let i = 0; i < rowCount; i++) {
    rows.push({
      allocationId: (allocationIds[i] ?? "").trim(),
      projectId: (projectIds[i] ?? "").trim(),
      taskId: (taskIds[i] ?? "").trim(),
      hoursRaw: (hoursValues[i] ?? "").trim(),
      note: (notes[i] ?? "").trim(),
    });
  }

  return rows;
}

function isBlankRow(row: DailyEntryRow) {
  return !row.projectId && !row.hoursRaw;
}

function saveDayEffort(
  db: KosuDatabase,
  memberId: string,
  workDate: string,
  formData: FormData,
): DailyEntryResult {
  const totalWorkingHours = Number(
    String(formData.get("totalWorkingHours") ?? "").trim(),
  );

  if (!isValidQuarterHour(totalWorkingHours)) {
    return { error: "総稼働時間は 0.25h 単位で入力してください。" };
  }

  const rows = parseDailyEntryRows(formData).filter((row) => !isBlankRow(row));

  for (const row of rows) {
    if (!row.projectId) {
      return { error: "案件を選択してください。" };
    }

    if (!isValidQuarterHour(Number(row.hoursRaw))) {
      return { error: "実績工数は 0.25h 単位で入力してください。" };
    }
  }

  const existingById = new Map<string, EffortAllocationRow>();

  for (const row of rows) {
    if (!row.allocationId) {
      continue;
    }

    const allocation = findAllocationById(db, row.allocationId);
    const allocationLog = allocation
      ? findDailyWorkLogById(db, allocation.dailyWorkLogId)
      : undefined;

    if (
      !isOwnedAllocationOnDate(allocation, allocationLog, memberId, workDate)
    ) {
      throw new Response("Not found", { status: 404 });
    }

    existingById.set(row.allocationId, allocation!);
  }

  const resolvedRows = rows.map((row) => {
    const existing = existingById.get(row.allocationId);

    return {
      row,
      existing,
      taskId: row.taskId || existing?.taskId || undefined,
    };
  });

  for (const { row, existing, taskId } of resolvedRows) {
    const allocationTargetError = validateAllocationTarget(
      db,
      memberId,
      row.projectId,
      taskId,
      existing,
    );

    if (allocationTargetError) {
      return { error: allocationTargetError };
    }
  }

  const targetMember = findMemberById(db, memberId);

  db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    const workLog = findDailyWorkLogByMemberAndDate(tx, memberId, workDate);
    const workLogId = workLog
      ? (updateDailyWorkLog(tx, workLog.id, { totalWorkingHours }), workLog.id)
      : createDailyWorkLog(tx, { memberId, workDate, totalWorkingHours }).id;

    for (const { row, existing, taskId } of resolvedRows) {
      const allocatedHours = Number(row.hoursRaw);

      if (existing) {
        updateEffortAllocation(tx, existing.id, {
          projectId: row.projectId,
          taskId: taskId ?? null,
          allocatedHours,
          note: row.note || undefined,
        });
        continue;
      }

      createEffortAllocation(tx, {
        dailyWorkLogId: workLogId,
        memberId,
        projectId: row.projectId,
        taskId: taskId ?? null,
        allocatedHours,
        note: row.note || undefined,
        hourlyCostRateSnapshot: targetMember?.hourlyCostRate ?? null,
      });
    }
  });

  return { success: `実績工数 ${resolvedRows.length} 件を保存しました。` };
}

function copyPreviousDayEffort(
  db: KosuDatabase,
  memberId: string,
  workDate: string,
): DailyEntryResult {
  const previousDate = addDays(workDate, -1);
  const currentLog = findDailyWorkLogByMemberAndDate(db, memberId, workDate);
  const currentAllocations = currentLog
    ? listAllocationsByWorkLog(db, currentLog.id)
    : [];

  if (currentAllocations.length > 0) {
    return {
      error: "既に実績工数が登録されているため、前日から複製できません。",
    };
  }

  const previousLog = findDailyWorkLogByMemberAndDate(
    db,
    memberId,
    previousDate,
  );
  const previousAllocations = previousLog
    ? listAllocationsByWorkLog(db, previousLog.id)
    : [];

  if (!previousLog || previousAllocations.length === 0) {
    return { error: "前日に複製する内容がありません。" };
  }

  const usable = previousAllocations.filter(
    (allocation) =>
      !validateAllocationTarget(
        db,
        memberId,
        allocation.projectId,
        allocation.taskId ?? undefined,
      ),
  );
  const skipped = previousAllocations.filter((allocation) =>
    validateAllocationTarget(
      db,
      memberId,
      allocation.projectId,
      allocation.taskId ?? undefined,
    ),
  );

  if (usable.length === 0) {
    return { error: "前日の実績に複製できる案件がないため、複製できません。" };
  }

  const targetMember = findMemberById(db, memberId);

  db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    const workLog =
      currentLog ??
      createDailyWorkLog(tx, {
        memberId,
        workDate,
        totalWorkingHours: previousLog.totalWorkingHours,
      });

    for (const allocation of usable) {
      createEffortAllocation(tx, {
        dailyWorkLogId: workLog.id,
        memberId,
        projectId: allocation.projectId,
        taskId: allocation.taskId ?? null,
        allocatedHours: allocation.allocatedHours,
        note: allocation.note ?? undefined,
        hourlyCostRateSnapshot: targetMember?.hourlyCostRate ?? null,
      });
    }
  });

  const skippedNames = [
    ...new Set(
      skipped.map(
        (allocation) => findProjectById(db, allocation.projectId)?.name ?? "",
      ),
    ),
  ].filter((name) => name !== "");
  const skippedSuffix =
    skippedNames.length > 0 ? `（スキップ: ${skippedNames.join("、")}）` : "";

  return {
    success: `前日（${previousDate}）から ${usable.length} 件を複製しました。${skippedSuffix}`,
  };
}

function validateAllocationTarget(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
  taskId?: string,
  existing?: { projectId: string; taskId: string | null },
) {
  const project = findProjectById(db, projectId);

  if (!project) {
    return "有効な案件を選択してください。";
  }

  const keepsExistingProject = existing?.projectId === projectId;

  if (!keepsExistingProject) {
    if (project.isArchived) {
      return "有効な案件を選択してください。";
    }

    if (!findActiveAssignment(db, memberId, projectId)) {
      return "アサインされていない案件には実績工数を登録できません。";
    }
  }

  if (!taskId) {
    return undefined;
  }

  const task = findTaskById(db, taskId);

  if (!task || task.projectId !== projectId) {
    return "有効なタスクを選択してください。";
  }

  const keepsExistingTask = existing?.taskId === taskId;

  if (!keepsExistingTask && task.isArchived) {
    return "有効なタスクを選択してください。";
  }

  return undefined;
}

export const meta: Route.MetaFunction = () => [
  { title: "日別工数実績入力 | kosu" },
];

export default function WorkLogEntry({ actionData }: Route.ComponentProps) {
  const {
    closeStatus,
    currentMemberId,
    today,
    workDate,
    month,
    workLog,
    allocations,
    assignedProjects,
    activeTasks,
    referencedOnlyProjectIds,
    targetMember,
    isLocked,
  } = useLoaderData<typeof loader>();
  const referencedOnlyProjects = new Set(referencedOnlyProjectIds);
  const projectLabel = (project: {
    id: string;
    name: string;
    isArchived?: boolean;
  }) => {
    if (!referencedOnlyProjects.has(project.id)) {
      return project.name;
    }

    return `${project.name}（${project.isArchived ? "アーカイブ済み" : "アサイン解除済み"}）`;
  };
  const allocatedTotal = allocations.reduce(
    (sum, a) => sum + a.allocatedHours,
    0,
  );
  const totalWorkingHours = workLog?.totalWorkingHours ?? 0;
  const variance = totalWorkingHours - allocatedTotal;
  const previousDate = addDays(workDate, -1);
  const nextDate = addDays(workDate, 1);
  const blankRowKeys = ["new-row-1"];
  const renderProjectSelect = (value: string) => (
    <select
      className="block w-full min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      defaultValue={value}
      disabled={isLocked}
      name="projectId"
    >
      <option value="">選択</option>
      {assignedProjects.map((project) => (
        <option key={project.id} value={project.id}>
          {projectLabel(project)}
        </option>
      ))}
    </select>
  );
  const renderTaskSelect = (value: string) => (
    <select
      className="block w-full min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      defaultValue={value}
      disabled={isLocked}
      name="taskId"
    >
      <option value="">未指定</option>
      {assignedProjects.map((project) => {
        const projectTasks = activeTasks.filter(
          (task) => task.projectId === project.id,
        );

        return projectTasks.length > 0 ? (
          <optgroup key={project.id} label={projectLabel(project)}>
            {projectTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
  const memberQuery =
    targetMember.id !== currentMemberId ? `?memberId=${targetMember.id}` : "";
  const weekday = getWeekdayLabel(workDate);
  const isSunday = isSundayDate(workDate);
  const isSaturday = isSaturdayDate(workDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            日別工数実績入力
          </h1>
          <p className="text-sm text-slate-600">
            {targetMember.displayName} · {workDate}（{weekday}） · {month}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSunday ? <Badge tone="danger">日曜</Badge> : null}
          {isSaturday ? <Badge tone="info">土曜</Badge> : null}
          <MonthlyCloseStatusBadge status={closeStatus} />
        </div>
      </div>

      <MonthlyCloseReadOnlyNotice month={month} status={closeStatus} />

      <div className="flex flex-wrap gap-2">
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          to={`/work-logs/${previousDate}${memberQuery}`}
        >
          前日
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          to={`/work-logs/${today}${memberQuery}`}
        >
          今日
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          to={`/work-logs/${nextDate}${memberQuery}`}
        >
          翌日
        </Link>
      </div>

      {actionData?.error ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {actionData.error}
        </p>
      ) : null}

      {actionData?.success ? (
        <p
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {actionData.success}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{workDate} の実績工数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form className="space-y-4" method="post">
            {allocations.map((allocation) => (
              <input
                key={allocation.id}
                name="allocationId"
                type="hidden"
                value={allocation.id}
              />
            ))}
            {blankRowKeys.map((key) => (
              <input key={key} name="allocationId" type="hidden" value="" />
            ))}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="総稼働時間（0.25h 単位）">
                <Input
                  defaultValue={workLog?.totalWorkingHours ?? ""}
                  disabled={isLocked}
                  name="totalWorkingHours"
                  step="0.25"
                  type="number"
                  required
                />
              </Field>
              <Button
                disabled={isLocked}
                name="intent"
                type="submit"
                value="saveWorkLog"
                variant="outline"
              >
                総稼働時間のみ保存
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:flex-row">
              <span>総稼働: {totalWorkingHours}h</span>
              <span>案件別実績工数: {allocatedTotal}h</span>
              <span
                className={
                  variance === 0 ? "text-emerald-700" : "text-amber-700"
                }
              >
                {variance > 0 ? `未割当: ${variance}h` : null}
                {variance < 0 ? `超過: ${Math.abs(variance)}h` : null}
                {variance === 0 ? "割当済み" : null}
              </span>
            </div>

            {assignedProjects.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                アサインされている案件がありません。管理者にアサインを依頼するか、セルフアサインで案件を追加してください。
              </p>
            ) : null}

            <DataTable
              columns={["案件", "タスク", "実績時間", "備考", "操作"]}
              emptyMessage="案件別実績工数はまだありません。"
              rows={[
                ...allocations.map((allocation) => [
                  renderProjectSelect(allocation.projectId),
                  renderTaskSelect(allocation.taskId ?? ""),
                  <Input
                    className="w-28"
                    defaultValue={allocation.allocatedHours}
                    disabled={isLocked}
                    name="allocatedHours"
                    step="0.25"
                    type="number"
                  />,
                  <Input
                    className="min-w-40"
                    defaultValue={allocation.note ?? ""}
                    disabled={isLocked}
                    name="note"
                    type="text"
                  />,
                  <Button
                    disabled={isLocked}
                    formNoValidate
                    name="deleteAllocationId"
                    type="submit"
                    value={allocation.id}
                    variant="outline"
                  >
                    削除
                  </Button>,
                ]),
                ...blankRowKeys.map((key) => [
                  renderProjectSelect(""),
                  renderTaskSelect(""),
                  <Input
                    defaultValue=""
                    disabled={isLocked}
                    key={`${key}-hours`}
                    name="allocatedHours"
                    step="0.25"
                    type="number"
                  />,
                  <Input
                    className="min-w-40"
                    disabled={isLocked}
                    name="note"
                    type="text"
                  />,
                  <span className="text-xs text-slate-400">新規</span>,
                ]),
              ]}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={isLocked}
                name="intent"
                type="submit"
                value="saveDay"
                variant="primary"
              >
                実績を保存
              </Button>
              <Button
                disabled={isLocked}
                formNoValidate
                name="intent"
                type="submit"
                value="copyPrevious"
                variant="secondary"
              >
                前日から複製
              </Button>
              <p className="text-xs text-slate-500">
                「実績を保存」は総稼働時間と案件別実績工数の両方を反映します。総稼働時間だけを先に記録したい場合は「総稼働時間のみ保存」を使ってください。
              </p>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
