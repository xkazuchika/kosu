// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSpec = readFileSync(
  resolve(process.cwd(), "openspec/specs/dashboard/spec.md"),
  "utf8",
);

function requirementBlock(name: string) {
  const marker = `### Requirement: ${name}`;
  const start = dashboardSpec.indexOf(marker);
  if (start < 0) throw new Error(`Requirement not found: ${name}`);
  const next = dashboardSpec.indexOf(
    "\n### Requirement:",
    start + marker.length,
  );
  return dashboardSpec.slice(start, next < 0 ? undefined : next);
}

test("dashboard scenarios remain attached to their intended requirements", () => {
  const nextActions = requirementBlock("Dashboard next-action guidance");
  const submissions = requirementBlock("Monthly submission dashboard status");

  expect(nextActions).toContain(
    "#### Scenario: Member sees monthly workflow status",
  );
  expect(nextActions).toContain(
    "#### Scenario: Administrator sees team next actions",
  );
  expect(submissions).not.toContain(
    "#### Scenario: Member sees monthly workflow status",
  );
  expect(submissions).not.toContain(
    "#### Scenario: Administrator sees team next actions",
  );
  expect(submissions).toContain(
    "#### Scenario: Member sees own submission status",
  );
  expect(submissions).toContain(
    "#### Scenario: Administrator sees team submission summary",
  );
});
