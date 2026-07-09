// @vitest-environment node

import { schema } from "../../app/db/schema";

test("database schema exports all MVP tables", () => {
  expect(Object.keys(schema).sort()).toEqual([
    "dailyAllocationPlans",
    "dailyWorkLogs",
    "effortAllocations",
    "importJobs",
    "memberMonthlyCapacities",
    "members",
    "monthlyPlans",
    "periodLocks",
    "projectAssignments",
    "projects",
    "sessions",
    "tasks",
    "workspaceSettings",
  ]);
});
