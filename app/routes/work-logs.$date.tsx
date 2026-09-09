import { useState, useSyncExternalStore } from "react";
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
  isValidCalendarDate,
  isValidDailyHours,
} from "~/lib/time";
import { getMonthlyCostCloseState } from "~/services/monthly-cost-close";
import { requireUnlockedMonth } from "~/services/period-lock";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";
import {
  DailyEffortEntryError,
  getDailyEffortStartingPoint,
  saveDailyEffortEntry,
} from "~/services/daily-effort-entry";
import { getMemberProjectEffortContext } from "~/services/project-effort";

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
    if (!isValidCalendarDate(workDate)) {
      throw new Response("Bad Request", { status: 400 });
    }
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
    const projectEffortContext = Object.fromEntries(
      getMemberProjectEffortContext(db, targetMemberId, month),
    );

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
      projectEffortContext,
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
    if (!isValidCalendarDate(workDate)) {
      throw new Response("Bad Request", { status: 400 });
    }
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

      if (!isValidDailyHours(totalWorkingHours)) {
        return {
          error: "総稼働時間は 0.25h 単位の正の値で、24h 以下にしてください。",
        };
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

    if (intent === "draftPlan" || intent === "draftRecent") {
      requireUnlockedMonth(db, month);
      try {
        const startingPoint = getDailyEffortStartingPoint(db, {
          memberId: targetMemberId,
          workDate,
          source: intent === "draftPlan" ? "daily-plan" : "recent-workday",
        });
        return {
          draft: {
            totalWorkingHours: String(startingPoint.totalWorkingHours),
            rows: startingPoint.rows.map((row) => ({
              allocationId: "",
              projectId: row.projectId,
              taskId: row.taskId ?? "",
              allocatedHours: String(row.allocatedHours),
              note: row.note ?? "",
            })),
          },
          success:
            startingPoint.source === "daily-plan"
              ? "この日の予定から未保存の下書きを作成しました。確認して保存してください。"
              : `${startingPoint.sourceDate} の実績から未保存の下書きを作成しました。確認して保存してください。`,
        };
      } catch (error) {
        if (error instanceof DailyEffortEntryError)
          return { error: error.message };
        throw error;
      }
    }

    if (intent === "saveDay") {
      const draft = buildSubmittedDailyDraft(formData);
      try {
        const result = saveDailyEffortEntry(db, {
          memberId: targetMemberId,
          workDate,
          totalWorkingHours: Number(draft.totalWorkingHours),
          rows: draft.rows
            .filter((row) => row.projectId || row.allocatedHours)
            .map((row) => ({
              allocationId: row.allocationId || undefined,
              projectId: row.projectId,
              taskId: row.taskId || undefined,
              allocatedHours: Number(row.allocatedHours),
              note: row.note || undefined,
            })),
        });
        return {
          success: `実績工数 ${result.allocationCount} 件を保存しました。`,
        };
      } catch (error) {
        if (error instanceof DailyEffortEntryError) {
          return { error: error.message, draft };
        }
        throw error;
      }
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

type SubmittedDailyDraft = {
  totalWorkingHours: string;
  rows: {
    allocationId: string;
    projectId: string;
    taskId: string;
    allocatedHours: string;
    note: string;
  }[];
};

function buildSubmittedDailyDraft(formData: FormData): SubmittedDailyDraft {
  const allocationIds = formData.getAll("allocationId").map(String);
  const projectIds = formData.getAll("projectId").map(String);
  const taskIds = formData.getAll("taskId").map(String);
  const hours = formData.getAll("allocatedHours").map(String);
  const notes = formData.getAll("note").map(String);
  const rowCount = Math.max(
    allocationIds.length,
    projectIds.length,
    hours.length,
    notes.length,
  );
  return {
    totalWorkingHours: String(formData.get("totalWorkingHours") ?? ""),
    rows: Array.from({ length: rowCount }, (_, index) => ({
      allocationId: allocationIds[index] ?? "",
      projectId: projectIds[index] ?? "",
      taskId: taskIds[index] ?? "",
      allocatedHours: hours[index] ?? "",
      note: notes[index] ?? "",
    })),
  };
}

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

  if (
    !isValidDailyHours(previousLog.totalWorkingHours) ||
    usable.some(
      (allocation) => !isValidDailyHours(allocation.allocatedHours),
    ) ||
    usable.reduce((sum, allocation) => sum + allocation.allocatedHours, 0) > 24
  ) {
    return { error: "前日の実績が1日の24h上限を超えているため、複製できません。" };
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
    projectEffortContext,
  } = useLoaderData<typeof loader>();
  const previousDate = addDays(workDate, -1);
  const nextDate = addDays(workDate, 1);
  const memberQuery =
    targetMember.id !== currentMemberId ? `?memberId=${targetMember.id}` : "";
  const weekQuery = new URLSearchParams({ date: workDate });
  if (targetMember.id !== currentMemberId)
    weekQuery.set("memberId", targetMember.id);
  const returnedDraft = (
    actionData as { draft?: SubmittedDailyDraft } | undefined
  )?.draft;
  const initialDraft: SubmittedDailyDraft = returnedDraft ?? {
    totalWorkingHours: workLog ? String(workLog.totalWorkingHours) : "",
    rows: allocations.map((allocation) => ({
      allocationId: allocation.id,
      projectId: allocation.projectId,
      taskId: allocation.taskId ?? "",
      allocatedHours: String(allocation.allocatedHours),
      note: allocation.note ?? "",
    })),
  };
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
        <Link
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
          to={`/work-logs/week?${weekQuery}`}
        >
          週まとめ入力
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
        <CardContent>
          <DailyEntryEditor
            key={JSON.stringify(initialDraft)}
            activeTasks={activeTasks}
            assignedProjects={assignedProjects}
            initialDraft={initialDraft}
            isLocked={isLocked}
            projectEffortContext={projectEffortContext}
            referencedOnlyProjectIds={referencedOnlyProjectIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type EditorRow = SubmittedDailyDraft["rows"][number] & { key: string };

export function DailyEntryEditor({
  activeTasks,
  assignedProjects,
  initialDraft,
  isLocked,
  projectEffortContext,
  referencedOnlyProjectIds,
}: {
  activeTasks: {
    id: string;
    name: string;
    projectId: string;
    isArchived: boolean;
  }[];
  assignedProjects: { id: string; name: string; isArchived: boolean }[];
  initialDraft: SubmittedDailyDraft;
  isLocked: boolean;
  projectEffortContext: Record<
    string,
    { plannedHours: number; actualHours: number; balanceHours: number }
  >;
  referencedOnlyProjectIds: string[];
}) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState,
  );
  const [totalWorkingHours, setTotalWorkingHours] = useState(
    initialDraft.totalWorkingHours,
  );
  const [rows, setRows] = useState<EditorRow[]>(() =>
    (initialDraft.rows.length > 0 ? initialDraft.rows : [emptyEditorRow()]).map(
      (row, index) => ({
        ...row,
        key: `${row.allocationId || "new"}-${index}`,
      }),
    ),
  );
  const total = Number(totalWorkingHours) || 0;
  const allocated = rows.reduce(
    (sum, row) => sum + (Number(row.allocatedHours) || 0),
    0,
  );
  const remaining = total - allocated;
  const referencedOnly = new Set(referencedOnlyProjectIds);

  function updateRow(key: string, values: Partial<EditorRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...values } : row)),
    );
  }

  return (
    <Form className="space-y-5" data-entry-ready={isHydrated} method="post">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field label="実際の総稼働時間（0.25h 単位）">
          <Input
            disabled={isLocked}
            min="0.25"
            name="totalWorkingHours"
            onChange={(event) => setTotalWorkingHours(event.target.value)}
            step="0.25"
            type="number"
            value={totalWorkingHours}
            required
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isLocked}
            formNoValidate
            name="intent"
            type="submit"
            value="draftPlan"
            variant="outline"
          >
            今日の予定から下書き
          </Button>
          <Button
            disabled={isLocked}
            formNoValidate
            name="intent"
            type="submit"
            value="draftRecent"
            variant="outline"
          >
            直近勤務日から下書き
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <span>
          総稼働: <strong>{total}h</strong>
        </span>
        <span>
          割当済み: <strong>{allocated}h</strong>
        </span>
        <span
          className={remaining === 0 ? "text-emerald-700" : "text-amber-700"}
        >
          <strong>
            {remaining === 0
              ? "割当完了"
              : remaining > 0
                ? `未割当 ${remaining}h`
                : `超過 ${Math.abs(remaining)}h`}
          </strong>
        </span>
      </div>

      {assignedProjects.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          アサインされている案件がありません。管理者にアサインを依頼するか、セルフアサインで案件を追加してください。
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">案件</th>
              <th className="px-3 py-2">タスク</th>
              <th className="px-3 py-2">実績時間</th>
              <th className="px-3 py-2">備考</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const progress = projectEffortContext[row.projectId];
              const projectTasks = activeTasks.filter(
                (task) => task.projectId === row.projectId,
              );
              return (
                <tr
                  className="border-t border-slate-100 align-top"
                  key={row.key}
                >
                  <td className="min-w-52 px-3 py-3">
                    <input
                      name="allocationId"
                      type="hidden"
                      value={row.allocationId}
                    />
                    <select
                      aria-label={`案件 ${rowIndex + 1}`}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      disabled={isLocked}
                      name="projectId"
                      onChange={(event) =>
                        updateRow(row.key, {
                          projectId: event.target.value,
                          taskId: "",
                        })
                      }
                      value={row.projectId}
                    >
                      <option value="">選択</option>
                      {assignedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                          {referencedOnly.has(project.id)
                            ? `（${project.isArchived ? "アーカイブ済み" : "アサイン解除済み"}）`
                            : ""}
                        </option>
                      ))}
                    </select>
                    {progress ? (
                      <p className="mt-1 text-xs text-slate-500">
                        今月 {progress.actualHours} / {progress.plannedHours}h ·
                        残り {progress.balanceHours}h
                      </p>
                    ) : null}
                  </td>
                  <td className="min-w-44 px-3 py-3">
                    <select
                      aria-label={`タスク ${rowIndex + 1}`}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                      disabled={isLocked || !row.projectId}
                      name="taskId"
                      onChange={(event) =>
                        updateRow(row.key, { taskId: event.target.value })
                      }
                      value={row.taskId}
                    >
                      <option value="">未指定</option>
                      {projectTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                          {task.isArchived ? "（アーカイブ済み）" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="min-w-36 px-3 py-3">
                    <Input
                      aria-label={`実績時間 ${rowIndex + 1}`}
                      disabled={isLocked}
                      min="0.25"
                      name="allocatedHours"
                      onChange={(event) =>
                        updateRow(row.key, {
                          allocatedHours: event.target.value,
                        })
                      }
                      step="0.25"
                      type="number"
                      value={row.allocatedHours}
                    />
                    <Button
                      className="mt-1 px-2 py-1 text-xs"
                      disabled={isLocked || remaining <= 0 || !row.projectId}
                      onClick={() =>
                        updateRow(row.key, {
                          allocatedHours: String(
                            (Number(row.allocatedHours) || 0) + remaining,
                          ),
                        })
                      }
                      variant="ghost"
                    >
                      残りを全部
                    </Button>
                  </td>
                  <td className="min-w-48 px-3 py-3">
                    <Input
                      aria-label={`備考 ${rowIndex + 1}`}
                      disabled={isLocked}
                      name="note"
                      onChange={(event) =>
                        updateRow(row.key, { note: event.target.value })
                      }
                      type="text"
                      value={row.note}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      disabled={isLocked || rows.length === 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                      variant="outline"
                    >
                      行を削除
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isLocked}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                ...emptyEditorRow(),
                key: `new-${Date.now()}-${current.length}`,
              },
            ])
          }
          variant="outline"
        >
          行を追加
        </Button>
        <Button
          disabled={isLocked}
          name="intent"
          type="submit"
          value="saveDay"
          variant="primary"
        >
          実績をまとめて保存
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        総稼働時間は実際に働いた時間です。8時間固定ではなく、短時間勤務や残業をそのまま入力できます。
      </p>
    </Form>
  );
}

function emptyEditorRow(): SubmittedDailyDraft["rows"][number] {
  return {
    allocationId: "",
    projectId: "",
    taskId: "",
    allocatedHours: "",
    note: "",
  };
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationState() {
  return true;
}

function getServerHydrationState() {
  return false;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
