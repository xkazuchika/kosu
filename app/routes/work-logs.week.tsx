import { useState, useSyncExternalStore } from "react";
import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs.week";

import { MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import {
  findMemberById,
  listMembers,
  withoutMemberFinancials,
} from "~/db/repositories/members";
import { listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import {
  findProjectById,
  withoutProjectFinancials,
} from "~/db/repositories/projects";
import {
  findTaskById,
  listActiveTasksByProject,
} from "~/db/repositories/tasks";
import {
  addCalendarDays,
  getWeekdayLabel,
  isValidCalendarDate,
} from "~/lib/time";
import { getSessionMember } from "~/services/auth";
import { DailyEffortEntryError } from "~/services/daily-effort-entry";
import { getMonthlyCostCloseState } from "~/services/monthly-cost-close";
import {
  getWeeklyEffortDraft,
  saveWeeklyEffortDraft,
  type WeeklyEffortDraft,
} from "~/services/weekly-effort-entry";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { db, sqlite } = createDatabaseConnection();
  try {
    const currentMember = getSessionMember(db, request);
    if (!currentMember) throw new Response("Unauthorized", { status: 401 });
    const url = new URL(request.url);
    const { today } = getWorkspaceCalendarContext(db);
    const requestedDate = url.searchParams.get("date") ?? today;
    const selectedDate = isValidCalendarDate(requestedDate)
      ? requestedDate
      : today;
    const requestedMemberId = url.searchParams.get("memberId");
    const isAdmin = currentMember.role === "admin";
    const targetMemberId =
      isAdmin && requestedMemberId ? requestedMemberId : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);
    if (!targetMember) throw new Response("Not found", { status: 404 });

    const draft = getWeeklyEffortDraft(db, targetMemberId, selectedDate);
    const assigned = listActiveAssignmentsByMember(db, targetMemberId)
      .map((assignment) => findProjectById(db, assignment.projectId))
      .filter((project): project is NonNullable<typeof project> =>
        Boolean(project && !project.isArchived),
      );
    const assignedIds = new Set(assigned.map((project) => project.id));
    const referencedProjects = [
      ...new Set(draft.rows.map((row) => row.projectId)),
    ]
      .filter((projectId) => !assignedIds.has(projectId))
      .map((projectId) => findProjectById(db, projectId))
      .filter((project): project is NonNullable<typeof project> =>
        Boolean(project),
      );
    const projects = isAdmin
      ? [...assigned, ...referencedProjects]
      : [...assigned, ...referencedProjects].map(withoutProjectFinancials);
    const activeTasks = assigned.flatMap((project) =>
      listActiveTasksByProject(db, project.id),
    );
    const activeTaskIds = new Set(activeTasks.map((task) => task.id));
    const referencedTasks = [...new Set(draft.rows.map((row) => row.taskId))]
      .filter((taskId) => taskId && !activeTaskIds.has(taskId))
      .map((taskId) => findTaskById(db, taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
    const closeStates = [
      ...new Set(draft.dates.map((date) => date.slice(0, 7))),
    ].map((month) => getMonthlyCostCloseState(db, month));

    return {
      currentMemberId: currentMember.id,
      isAdmin,
      targetMember: withoutMemberFinancials(targetMember),
      members: isAdmin ? listMembers(db).map(withoutMemberFinancials) : [],
      projects,
      referencedOnlyProjectIds: referencedProjects.map((project) => project.id),
      tasks: [...activeTasks, ...referencedTasks],
      draft,
      closeStates,
      isLocked: closeStates.some((state) => state.isProtected),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();
  let submittedDraft: WeeklyEffortDraft | undefined;
  try {
    const currentMember = getSessionMember(db, request);
    if (!currentMember) throw new Response("Unauthorized", { status: 401 });
    const url = new URL(request.url);
    const requestedMemberId = url.searchParams.get("memberId");
    const targetMemberId =
      currentMember.role === "admin" && requestedMemberId
        ? requestedMemberId
        : currentMember.id;
    const formData = await request.formData();
    submittedDraft = JSON.parse(
      String(formData.get("weeklyDraft") ?? ""),
    ) as WeeklyEffortDraft;
    const result = saveWeeklyEffortDraft(
      db,
      targetMemberId,
      submittedDraft,
      currentMember.id,
    );
    return { success: `${result.changedDates}日分の実績工数を保存しました。` };
  } catch (error) {
    if (error instanceof Response) throw error;
    if (
      error instanceof DailyEffortEntryError ||
      error instanceof SyntaxError
    ) {
      return {
        error:
          error instanceof SyntaxError
            ? "週次入力データが不正です。"
            : error.message,
        draft: submittedDraft,
      };
    }
    throw error;
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [
  { title: "週次工数実績入力 | kosu" },
];

export default function WeeklyWorkLogs({ actionData }: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  const initialDraft = actionData?.draft ?? data.draft;
  const memberSuffix =
    data.targetMember.id !== data.currentMemberId
      ? `&memberId=${data.targetMember.id}`
      : "";
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            週次工数実績入力
          </h1>
          <p className="text-sm text-slate-600">
            {data.targetMember.displayName} · {initialDraft.dates[0]} 〜{" "}
            {initialDraft.dates[6]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.closeStates.map((state) => (
            <MonthlyCloseStatusBadge key={state.month} status={state.status} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
          to={`/work-logs/week?date=${addCalendarDays(initialDraft.dates[0], -7)}${memberSuffix}`}
        >
          前週
        </Link>
        <Link
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800"
          to={`/work-logs/${initialDraft.dates[0]}${data.targetMember.id !== data.currentMemberId ? `?memberId=${data.targetMember.id}` : ""}`}
        >
          日別入力
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
          to={`/work-logs/week?date=${addCalendarDays(initialDraft.dates[0], 7)}${memberSuffix}`}
        >
          翌週
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

      {data.isAdmin ? (
        <Card>
          <CardContent>
            <Form className="flex flex-wrap items-end gap-3" method="get">
              <input name="date" type="hidden" value={initialDraft.dates[0]} />
              <label className="text-sm font-medium">
                対象メンバー
                <select
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"
                  defaultValue={data.targetMember.id}
                  name="memberId"
                >
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline">
                表示
              </Button>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>実績配賦</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyEntryEditor
            key={JSON.stringify(initialDraft)}
            draft={initialDraft}
            isLocked={data.isLocked}
            projects={data.projects}
            referencedOnlyProjectIds={data.referencedOnlyProjectIds}
            tasks={data.tasks}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function WeeklyEntryEditor({
  draft: initialDraft,
  isLocked,
  projects,
  referencedOnlyProjectIds,
  tasks,
}: {
  draft: WeeklyEffortDraft;
  isLocked: boolean;
  projects: { id: string; name: string; isArchived: boolean }[];
  referencedOnlyProjectIds: string[];
  tasks: { id: string; name: string; projectId: string; isArchived: boolean }[];
}) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState,
  );
  const [draft, setDraft] = useState<WeeklyEffortDraft>(() => ({
    ...initialDraft,
    rows: initialDraft.rows.length
      ? initialDraft.rows
      : [emptyWeeklyRow("new-0")],
  }));
  const referencedOnly = new Set(referencedOnlyProjectIds);
  const totals = Object.fromEntries(
    draft.dates.map((date) => [
      date,
      draft.rows.reduce((sum, row) => sum + (Number(row.hours[date]) || 0), 0),
    ]),
  );

  function updateRow(
    key: string,
    values: Partial<WeeklyEffortDraft["rows"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.key === key ? { ...row, ...values } : row,
      ),
    }));
  }

  return (
    <Form className="space-y-4" data-entry-ready={isHydrated} method="post">
      <input name="weeklyDraft" type="hidden" value={JSON.stringify(draft)} />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[1050px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 min-w-48 bg-slate-50 px-3 py-2 text-left">
                案件・タスク
              </th>
              {draft.dates.map((date) => (
                <th className="min-w-28 px-2 py-2 text-center" key={date}>
                  {date.slice(5)}（{getWeekdayLabel(date)}）
                </th>
              ))}
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200 bg-slate-50/70">
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">
                実際の総稼働
              </th>
              {draft.dates.map((date) => (
                <td className="px-2 py-2" key={date}>
                  <Input
                    aria-label={`${date} 総稼働時間`}
                    disabled={isLocked}
                    min="0.25"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        totalWorkingHours: {
                          ...current.totalWorkingHours,
                          [date]: event.target.value,
                        },
                      }))
                    }
                    step="0.25"
                    type="number"
                    value={draft.totalWorkingHours[date] ?? ""}
                  />
                </td>
              ))}
              <td />
            </tr>
            {draft.rows.map((row, rowIndex) => (
              <tr className="border-t border-slate-100 align-top" key={row.key}>
                <td className="sticky left-0 bg-white px-3 py-2">
                  <select
                    aria-label={`案件 ${rowIndex + 1}`}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-2 py-2"
                    disabled={isLocked}
                    onChange={(event) =>
                      updateRow(row.key, {
                        projectId: event.target.value,
                        taskId: "",
                      })
                    }
                    value={row.projectId}
                  >
                    <option value="">案件を選択</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {referencedOnly.has(project.id) ? "（履歴）" : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`タスク ${rowIndex + 1}`}
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2"
                    disabled={isLocked || !row.projectId}
                    onChange={(event) =>
                      updateRow(row.key, { taskId: event.target.value })
                    }
                    value={row.taskId}
                  >
                    <option value="">タスク未指定</option>
                    {tasks
                      .filter((task) => task.projectId === row.projectId)
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                          {task.isArchived ? "（履歴）" : ""}
                        </option>
                      ))}
                  </select>
                  <Input
                    aria-label={`備考 ${rowIndex + 1}`}
                    className="mt-2"
                    disabled={isLocked}
                    onChange={(event) =>
                      updateRow(row.key, { note: event.target.value })
                    }
                    placeholder="備考（任意）"
                    value={row.note}
                  />
                </td>
                {draft.dates.map((date) => (
                  <td className="px-2 py-2" key={date}>
                    <Input
                      aria-label={`${date} 実績時間 ${rowIndex + 1}`}
                      disabled={isLocked || !row.projectId}
                      min="0.25"
                      onChange={(event) =>
                        updateRow(row.key, {
                          hours: { ...row.hours, [date]: event.target.value },
                        })
                      }
                      step="0.25"
                      type="number"
                      value={row.hours[date] ?? ""}
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <Button
                    disabled={isLocked || draft.rows.length === 1}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        rows: current.rows.filter(
                          (item) => item.key !== row.key,
                        ),
                      }))
                    }
                    variant="outline"
                  >
                    削除
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">
                配賦 / 差分
              </th>
              {draft.dates.map((date) => {
                const total = Number(draft.totalWorkingHours[date]) || 0;
                const difference = total - totals[date];
                return (
                  <td
                    className={`px-2 py-2 text-center font-medium ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}
                    key={date}
                  >
                    {totals[date]}h /{" "}
                    {difference === 0
                      ? "完了"
                      : difference > 0
                        ? `残${difference}h`
                        : `超${Math.abs(difference)}h`}
                  </td>
                );
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isLocked}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              rows: [
                ...current.rows,
                emptyWeeklyRow(`new-${Date.now()}-${current.rows.length}`),
              ],
            }))
          }
          variant="outline"
        >
          行を追加
        </Button>
        <Button disabled={isLocked} type="submit" variant="primary">
          週の実績を保存
        </Button>
      </div>
    </Form>
  );
}

function emptyWeeklyRow(key: string): WeeklyEffortDraft["rows"][number] {
  return {
    key,
    projectId: "",
    taskId: "",
    note: "",
    allocationIds: {},
    hours: {},
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
