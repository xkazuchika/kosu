import { mkdirSync } from "node:fs";

import { and, eq } from "drizzle-orm";

import { createDatabaseConnection, runMigrations } from "../app/db/client";
import { resolveDatabaseConfig } from "../app/db/config";
import { createDailyWorkLog, findDailyWorkLogByMemberAndDate } from "../app/db/repositories/daily-work-logs";
import { createEffortAllocation, listAllocationsByWorkLog } from "../app/db/repositories/effort-allocations";
import { createMemberMonthlyCapacity, findCapacityByMemberAndMonth } from "../app/db/repositories/member-monthly-capacities";
import { createMember, findMemberByEmail } from "../app/db/repositories/members";
import { createMonthlyPlan, findMonthlyPlan } from "../app/db/repositories/monthly-plans";
import { createProject } from "../app/db/repositories/projects";
import { createProjectAssignment } from "../app/db/repositories/project-assignments";
import { createWorkspace, findWorkspace } from "../app/db/repositories/workspace";
import { projectAssignments, projects } from "../app/db/schema";
import { hashPassword } from "../app/lib/password";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("本番環境では demo seed を実行できません。");
    process.exit(1);
  }

  const config = resolveDatabaseConfig();
  mkdirSync(config.dataDir, { recursive: true });
  const { db, sqlite } = createDatabaseConnection(config.databaseUrl);
  runMigrations({ db, sqlite });

  const workspace = findWorkspace(db);

  if (!workspace) {
    createWorkspace(db, { displayName: "Demo Workspace", defaultTimezone: "Asia/Tokyo" });
  }

  const adminEmail = "admin@example.com";
  let admin = findMemberByEmail(db, adminEmail);

  if (!admin) {
    admin = createMember(db, {
      email: adminEmail,
      displayName: "山田 太郎",
      passwordHash: await hashPassword("password123"),
      role: "admin",
      departmentName: "Engineering",
      hourlyCostRate: 5000,
    });
  }

  void admin;

  const memberEmail = "member@example.com";
  let member = findMemberByEmail(db, memberEmail);

  if (!member) {
    member = createMember(db, {
      email: memberEmail,
      displayName: "佐藤 花子",
      passwordHash: await hashPassword("password123"),
      role: "member",
      departmentName: "Engineering",
      hourlyCostRate: 4000,
    });
  }

  const projectDefinitions = [
    { code: "INTERNAL", name: "社内業務", projectType: "internal" as const },
    { code: "WEBSITE", name: "コーポレートサイト改修", projectType: "billable" as const },
    { code: "CONSULT", name: "業務改善コンサルティング", projectType: "billable" as const },
  ];
  const month = new Date().toISOString().slice(0, 7);
  const workDate = `${month}-01`;

  for (const definition of projectDefinitions) {
    const { code } = definition;
    let project = db.select().from(projects).where(eq(projects.code, code)).get();

    if (!project) {
      project = createProject(db, {
        code,
        name: definition.name,
        projectType: definition.projectType,
        revenueOrBudgetAmount: code === "INTERNAL" ? 0 : 1_000_000,
      });
    }

    const existing = db
      .select()
      .from(projectAssignments)
      .where(and(eq(projectAssignments.memberId, member.id), eq(projectAssignments.projectId, project.id)))
      .get();

    if (!existing) {
      createProjectAssignment(db, { memberId: member.id, projectId: project.id, assignmentRole: "Engineer" });
    }

    if (!findMonthlyPlan(db, member.id, project.id, month, "Engineer")) {
      createMonthlyPlan(db, {
        memberId: member.id,
        projectId: project.id,
        month,
        assignmentRole: "Engineer",
        plannedHours: code === "INTERNAL" ? 24 : 48,
        hourlyCostRateSnapshot: member.hourlyCostRate,
      });
    }
  }

  if (!findCapacityByMemberAndMonth(db, member.id, month)) {
    createMemberMonthlyCapacity(db, { memberId: member.id, month, capacityHours: 160 });
  }

  const websiteProject = db.select().from(projects).where(eq(projects.code, "WEBSITE")).get();
  let workLog = findDailyWorkLogByMemberAndDate(db, member.id, workDate);

  if (!workLog) {
    workLog = createDailyWorkLog(db, { memberId: member.id, workDate, totalWorkingHours: 8 });
  }

  if (websiteProject && listAllocationsByWorkLog(db, workLog.id).length === 0) {
    createEffortAllocation(db, {
      dailyWorkLogId: workLog.id,
      memberId: member.id,
      projectId: websiteProject.id,
      allocatedHours: 8,
      note: "Demo allocation",
      hourlyCostRateSnapshot: member.hourlyCostRate,
    });
  }

  sqlite.close();
  console.log("Demo seed completed.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
