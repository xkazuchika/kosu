import { isValidMonth } from "./time";

export function parseEffortReportFilters(
  url: URL,
  member: { id: string; role: string },
  currentMonth: string,
) {
  const requestedMonth = url.searchParams.get("month");
  return {
    month:
      requestedMonth && isValidMonth(requestedMonth)
        ? requestedMonth
        : currentMonth,
    memberId:
      member.role === "admin"
        ? url.searchParams.get("memberId") || undefined
        : member.id,
    departmentName: url.searchParams.get("departmentName") || undefined,
    role: url.searchParams.get("role") || undefined,
    projectId: url.searchParams.get("projectId") || undefined,
    projectType: url.searchParams.get("projectType") || undefined,
  };
}

export function effortReportSearch(
  filters: ReturnType<typeof parseEffortReportFilters>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
