import { Form, Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs.$date";

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
  updateEffortAllocation,
} from "~/db/repositories/effort-allocations";
import { findMemberById } from "~/db/repositories/members";
import { findActiveAssignment, listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import { findProjectById } from "~/db/repositories/projects";
import { findTaskById, listActiveTasksByProject } from "~/db/repositories/tasks";
import { getSessionMember } from "~/services/auth";
import { isValidQuarterHour } from "~/lib/time";
import { isMonthLocked, requireUnlockedMonth } from "~/services/period-lock";

export const loader = async ({ request, params }: { request: Request; params: { date: string } }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const url = new URL(request.url);
    const memberIdParam = url.searchParams.get("memberId");
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const isAdmin = currentMember.role === "admin";
    const targetMemberId = memberIdParam && isAdmin ? memberIdParam : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    const workDate = params.date;
    const month = workDate.slice(0, 7);
    const workLog = findDailyWorkLogByMemberAndDate(db, targetMemberId, workDate);
    const allocations = workLog ? listAllocationsByWorkLog(db, workLog.id) : [];
    const assignedProjects = listActiveAssignmentsByMember(db, targetMemberId)
      .map((a) => findProjectById(db, a.projectId))
      .filter((p): p is NonNullable<typeof p> => p !== undefined && !p.isArchived);
    const activeTasks = assignedProjects.flatMap((project) =>
      listActiveTasksByProject(db, project.id).map((task) => ({ ...task, projectName: project.name })),
    );

    return {
      currentMemberId: currentMember.id,
      workDate,
      month,
      workLog,
      allocations,
      assignedProjects,
      activeTasks,
      isAdmin,
      targetMember,
      isLocked: isMonthLocked(db, month),
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
    const targetMemberId = memberIdParam && isAdmin ? memberIdParam : currentMember.id;

    if (targetMemberId !== currentMember.id && !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const workDate = params.date;
    const month = workDate.slice(0, 7);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "saveWorkLog");

    if (intent === "saveWorkLog") {
      requireUnlockedMonth(db, month);

      const totalWorkingHours = Number(formData.get("totalWorkingHours") ?? 0);

      if (!isValidQuarterHour(totalWorkingHours)) {
        return { error: "総稼働時間は 0.25h 単位で入力してください。" };
      }

      const existing = findDailyWorkLogByMemberAndDate(db, targetMemberId, workDate);

      if (existing) {
        updateDailyWorkLog(db, existing.id, { totalWorkingHours });
      } else {
        createDailyWorkLog(db, { memberId: targetMemberId, workDate, totalWorkingHours });
      }

      const adminQuery = isAdmin && memberIdParam ? `?memberId=${targetMemberId}` : "";
      return redirect(`/work-logs/${workDate}${adminQuery}`);
    }

    if (intent === "addAllocation") {
      requireUnlockedMonth(db, month);

      const workLog = findDailyWorkLogByMemberAndDate(db, targetMemberId, workDate);

      if (!workLog) {
        return { error: "先に勤務日の総稼働時間を保存してください。" };
      }

      const projectId = String(formData.get("projectId") ?? "");
      const taskIdRaw = String(formData.get("taskId") ?? "");
      const taskId = taskIdRaw || undefined;
      const allocatedHours = Number(formData.get("allocatedHours") ?? 0);
      const note = String(formData.get("note") ?? "").trim() || undefined;

      if (!projectId) {
        return { error: "案件を選択してください。" };
      }

      if (!isValidQuarterHour(allocatedHours)) {
        return { error: "実績工数は 0.25h 単位で入力してください。" };
      }

      const allocationTargetError = validateAllocationTarget(db, targetMemberId, projectId, taskId);

      if (allocationTargetError) {
        return { error: allocationTargetError };
      }

      const targetMember = findMemberById(db, targetMemberId);

      createEffortAllocation(db, {
        dailyWorkLogId: workLog.id,
        memberId: targetMemberId,
        projectId,
        taskId: taskId ?? null,
        allocatedHours,
        note,
        hourlyCostRateSnapshot: targetMember?.hourlyCostRate ?? null,
      });

      const adminQuery = isAdmin && memberIdParam ? `?memberId=${targetMemberId}` : "";
      return redirect(`/work-logs/${workDate}${adminQuery}`);
    }

    if (intent === "updateAllocation") {
      const allocationId = String(formData.get("allocationId") ?? "");
      const projectId = String(formData.get("projectId") ?? "");
      const taskIdRaw = String(formData.get("taskId") ?? "");
      const taskId = taskIdRaw || undefined;
      const allocatedHours = Number(formData.get("allocatedHours") ?? 0);
      const note = String(formData.get("note") ?? "").trim() || undefined;

      const allocation = findAllocationById(db, allocationId);
      const allocationLog = allocation ? findDailyWorkLogById(db, allocation.dailyWorkLogId) : undefined;

      if (
        !allocation ||
        allocation.deletedAt ||
        !allocationLog ||
        allocationLog.deletedAt ||
        allocationLog.memberId !== targetMemberId ||
        allocationLog.workDate !== workDate
      ) {
        throw new Response("Not found", { status: 404 });
      }

      requireUnlockedMonth(db, allocationLog.workDate.slice(0, 7));

      if (!projectId) {
        return { error: "案件を選択してください。" };
      }

      if (!isValidQuarterHour(allocatedHours)) {
        return { error: "実績工数は 0.25h 単位で入力してください。" };
      }

      const allocationTargetError = validateAllocationTarget(db, targetMemberId, projectId, taskId);

      if (allocationTargetError) {
        return { error: allocationTargetError };
      }

      updateEffortAllocation(db, allocationId, { projectId, taskId: taskId ?? null, allocatedHours, note });
      const adminQuery = isAdmin && memberIdParam ? `?memberId=${targetMemberId}` : "";
      return redirect(`/work-logs/${workDate}${adminQuery}`);
    }

    if (intent === "deleteAllocation") {
      const allocationId = String(formData.get("allocationId") ?? "");
      const allocation = findAllocationById(db, allocationId);
      const allocationLog = allocation ? findDailyWorkLogById(db, allocation.dailyWorkLogId) : undefined;

      if (
        !allocation ||
        allocation.deletedAt ||
        !allocationLog ||
        allocationLog.deletedAt ||
        allocationLog.memberId !== targetMemberId ||
        allocationLog.workDate !== workDate
      ) {
        throw new Response("Not found", { status: 404 });
      }

      requireUnlockedMonth(db, allocationLog.workDate.slice(0, 7));

      deleteEffortAllocation(db, allocationId, new Date().toISOString());
      const adminQuery = isAdmin && memberIdParam ? `?memberId=${targetMemberId}` : "";
      return redirect(`/work-logs/${workDate}${adminQuery}`);
    }

    return { error: "不明な操作です。" };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return { error: "保存に失敗しました。" };
  } finally {
    sqlite.close();
  }
};

function validateAllocationTarget(db: KosuDatabase, memberId: string, projectId: string, taskId?: string) {
  const project = findProjectById(db, projectId);

  if (!project || project.isArchived) {
    return "有効な案件を選択してください。";
  }

  if (!findActiveAssignment(db, memberId, projectId)) {
    return "アサインされていない案件には実績工数を登録できません。";
  }

  if (!taskId) {
    return undefined;
  }

  const task = findTaskById(db, taskId);

  if (!task || task.isArchived || task.projectId !== projectId) {
    return "有効なタスクを選択してください。";
  }

  return undefined;
}

export const meta: Route.MetaFunction = () => [{ title: "日別工数実績入力 | kosu" }];

export default function WorkLogEntry({ actionData }: Route.ComponentProps) {
  const { currentMemberId, workDate, month, workLog, allocations, assignedProjects, activeTasks, targetMember, isLocked } =
    useLoaderData<typeof loader>();
  const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
  const totalWorkingHours = workLog?.totalWorkingHours ?? 0;
  const variance = totalWorkingHours - allocatedTotal;
  const remainingAllocationHours = variance > 0 ? variance : "";
  const previousDate = addDays(workDate, -1);
  const nextDate = addDays(workDate, 1);
  const today = new Date().toISOString().slice(0, 10);
  const memberQuery = targetMember.id !== currentMemberId ? `?memberId=${targetMember.id}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">日別工数実績入力</h1>
          <p className="text-sm text-slate-600">
            {targetMember.displayName} · {workDate} · {month}
          </p>
        </div>
        {isLocked ? (
          <Badge tone="danger">ロック中</Badge>
        ) : (
          <Badge tone="success">編集可能</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/${previousDate}${memberQuery}`}>
          前日
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/${today}${memberQuery}`}>
          今日
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/${nextDate}${memberQuery}`}>
          翌日
        </Link>
      </div>

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>総稼働時間</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="post">
            <input name="intent" type="hidden" value="saveWorkLog" />
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
            <Button disabled={isLocked} type="submit" variant="primary">
              総稼働時間を保存
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>案件別実績工数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:flex-row">
            <span>総稼働: {totalWorkingHours}h</span>
            <span>案件別実績工数: {allocatedTotal}h</span>
            <span className={variance === 0 ? "text-emerald-700" : "text-amber-700"}>
              差分: {variance >= 0 ? "+" : ""}{variance}h
            </span>
          </div>

          <DataTable
            columns={["案件", "タスク", "実績時間", "備考", "操作"]}
            emptyMessage="案件別実績工数はまだありません。"
            rows={allocations.map((allocation) => {
              const formId = `allocation-${allocation.id}`;

              return [
                <select
                  className="block w-full min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  defaultValue={allocation.projectId}
                  disabled={isLocked}
                  form={formId}
                  name="projectId"
                  required
                >
                  {assignedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>,
                <select
                  className="block w-full min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  defaultValue={allocation.taskId ?? ""}
                  disabled={isLocked}
                  form={formId}
                  name="taskId"
                >
                  <option value="">未指定</option>
                  {assignedProjects.map((project) => {
                    const projectTasks = activeTasks.filter((task) => task.projectId === project.id);

                    return projectTasks.length > 0 ? (
                      <optgroup key={project.id} label={project.name}>
                        {projectTasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>,
                <Input
                  className="w-28"
                  defaultValue={allocation.allocatedHours}
                  disabled={isLocked}
                  form={formId}
                  name="allocatedHours"
                  step="0.25"
                  type="number"
                  required
                />,
                <Input
                  className="min-w-40"
                  defaultValue={allocation.note ?? ""}
                  disabled={isLocked}
                  form={formId}
                  name="note"
                  type="text"
                />,
                <Form className="flex gap-2" id={formId} key={allocation.id} method="post">
                  <input name="allocationId" type="hidden" value={allocation.id} />
                  <Button disabled={isLocked} name="intent" type="submit" value="updateAllocation" variant="primary">
                    変更を保存
                  </Button>
                  <Button disabled={isLocked} name="intent" type="submit" value="deleteAllocation" variant="outline">
                    削除
                  </Button>
                </Form>,
              ];
            })}
          />

          <Form className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5" method="post">
            <input name="intent" type="hidden" value="addAllocation" />
            <div>
              <label className="text-sm font-medium text-slate-800">案件</label>
              <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={isLocked} name="projectId" required>
                <option value="">選択</option>
                {assignedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">タスク（任意）</label>
              <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={isLocked} name="taskId">
                <option value="">未指定</option>
                {assignedProjects.map((project) => {
                  const projectTasks = activeTasks.filter((task) => task.projectId === project.id);

                  return projectTasks.length > 0 ? (
                    <optgroup key={project.id} label={project.name}>
                      {projectTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">実績時間</label>
              <Input className="mt-1" defaultValue={remainingAllocationHours} disabled={isLocked} name="allocatedHours" step="0.25" type="number" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">備考</label>
              <Input className="mt-1" disabled={isLocked} name="note" type="text" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={isLocked} type="submit" variant="primary">
                案件別実績工数を追加
              </Button>
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
