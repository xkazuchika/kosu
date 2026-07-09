import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const id = text("id").primaryKey();
const createdAt = text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const workspaceSettings = sqliteTable("workspace_settings", {
  id,
  displayName: text("display_name").notNull(),
  defaultTimezone: text("default_timezone").notNull(),
  createdAt,
  updatedAt,
});

export const members = sqliteTable(
  "members",
  {
    id,
    displayName: text("display_name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    departmentName: text("department_name"),
    hourlyCostRate: integer("hourly_cost_rate"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("members_department_role_index").on(table.departmentName, table.role),
    index("members_role_active_index").on(table.role, table.isActive),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt,
  },
  (table) => [index("sessions_member_id_index").on(table.memberId), index("sessions_expires_at_index").on(table.expiresAt)],
);

export const projects = sqliteTable(
  "projects",
  {
    id,
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    projectType: text("project_type", { enum: ["billable", "internal", "non_billable"] }).notNull(),
    clientName: text("client_name"),
    description: text("description"),
    revenueOrBudgetAmount: integer("revenue_or_budget_amount"),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: text("archived_at"),
    createdAt,
    updatedAt,
  },
  (table) => [index("projects_type_archived_index").on(table.projectType, table.isArchived)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id,
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: text("archived_at"),
    createdAt,
    updatedAt,
  },
  (table) => [index("tasks_project_archived_index").on(table.projectId, table.isArchived)],
);

export const projectAssignments = sqliteTable(
  "project_assignments",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assignmentRole: text("assignment_role"),
    assignmentSource: text("assignment_source", { enum: ["admin", "self_assigned"] }).notNull().default("admin"),
    assignedAt: text("assigned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    removedAt: text("removed_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("project_assignments_member_project_index").on(table.memberId, table.projectId),
    index("project_assignments_project_member_index").on(table.projectId, table.memberId),
    index("project_assignments_source_index").on(table.assignmentSource),
  ],
);

export const memberMonthlyCapacities = sqliteTable(
  "member_monthly_capacities",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    capacityHours: real("capacity_hours").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("member_monthly_capacity_member_month_unique").on(table.memberId, table.month),
    index("member_monthly_capacities_member_month_index").on(table.memberId, table.month),
    index("member_monthly_capacities_month_index").on(table.month),
  ],
);

export const monthlyPlans = sqliteTable(
  "monthly_plans",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    assignmentRole: text("assignment_role").notNull().default(""),
    plannedHours: real("planned_hours").notNull(),
    hourlyCostRateSnapshot: integer("hourly_cost_rate_snapshot"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("monthly_plan_member_project_month_role_unique").on(
      table.memberId,
      table.projectId,
      table.month,
      table.assignmentRole,
    ),
    index("monthly_plans_member_month_index").on(table.memberId, table.month),
    index("monthly_plans_project_month_index").on(table.projectId, table.month),
    index("monthly_plans_month_index").on(table.month),
  ],
);

export const dailyWorkLogs = sqliteTable(
  "daily_work_logs",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    workDate: text("work_date").notNull(),
    totalWorkingHours: real("total_working_hours").notNull(),
    deletedAt: text("deleted_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("daily_work_log_member_date_unique").on(table.memberId, table.workDate),
    index("daily_work_logs_member_date_index").on(table.memberId, table.workDate),
    index("daily_work_logs_work_date_index").on(table.workDate),
  ],
);

export const dailyAllocationPlans = sqliteTable(
  "daily_allocation_plans",
  {
    id,
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    planDate: text("plan_date").notNull(),
    plannedHours: real("planned_hours").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("daily_allocation_plan_member_date_project_unique").on(table.memberId, table.planDate, table.projectId),
    index("daily_allocation_plans_member_date_index").on(table.memberId, table.planDate),
    index("daily_allocation_plans_project_date_index").on(table.projectId, table.planDate),
  ],
);

export const effortAllocations = sqliteTable(
  "effort_allocations",
  {
    id,
    dailyWorkLogId: text("daily_work_log_id")
      .notNull()
      .references(() => dailyWorkLogs.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    allocatedHours: real("allocated_hours").notNull(),
    note: text("note"),
    hourlyCostRateSnapshot: integer("hourly_cost_rate_snapshot"),
    deletedAt: text("deleted_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("effort_allocations_daily_work_log_index").on(table.dailyWorkLogId),
    index("effort_allocations_member_project_index").on(table.memberId, table.projectId),
    index("effort_allocations_member_task_index").on(table.memberId, table.taskId),
    index("effort_allocations_project_member_index").on(table.projectId, table.memberId),
  ],
);

export const periodLocks = sqliteTable(
  "period_locks",
  {
    id,
    month: text("month").notNull().unique(),
    isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(true),
    lockedByMemberId: text("locked_by_member_id").references(() => members.id, { onDelete: "set null" }),
    lockedAt: text("locked_at"),
    unlockedByMemberId: text("unlocked_by_member_id").references(() => members.id, { onDelete: "set null" }),
    unlockedAt: text("unlocked_at"),
    createdAt,
    updatedAt,
  },
  (table) => [index("period_locks_month_index").on(table.month)],
);

export const importJobs = sqliteTable(
  "import_jobs",
  {
    id,
    importType: text("import_type", {
      enum: ["members", "projects", "project_assignments", "member_monthly_capacities", "monthly_plans"],
    }).notNull(),
    status: text("status", { enum: ["previewed", "committed", "failed"] }).notNull(),
    fileName: text("file_name"),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    resultSummary: text("result_summary"),
    createdByMemberId: text("created_by_member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt,
    committedAt: text("committed_at"),
  },
  (table) => [index("import_jobs_status_type_index").on(table.status, table.importType)],
);

export const schema = {
  dailyAllocationPlans,
  dailyWorkLogs,
  effortAllocations,
  importJobs,
  memberMonthlyCapacities,
  members,
  monthlyPlans,
  periodLocks,
  projectAssignments,
  projects,
  sessions,
  tasks,
  workspaceSettings,
};
