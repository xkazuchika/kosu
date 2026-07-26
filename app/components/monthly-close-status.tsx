import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";

type Status = "open" | "in_review" | "approved";
const statusLabels: Record<Status, string> = {
  open: "未締め",
  in_review: "レビュー中",
  approved: "承認済み",
};

export function MonthlyCloseStatusBadge({ month, status }: { month?: string; status: Status }) {
  const tone = status === "open" ? "success" : status === "in_review" ? "warning" : "neutral";
  return <Badge tone={tone}>{month ? `${month} · ` : ""}{statusLabels[status]}</Badge>;
}

export function MonthlyCloseReadOnlyNotice({ month, status }: { month: string; status: Status }) {
  if (status === "open") return null;

  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">
      {month} は「{statusLabels[status]}」のため閲覧のみです。修正する場合は
      <Link className="font-semibold text-indigo-700 hover:underline" to={`/period-locks?month=${month}`}>
        月次原価締め
      </Link>
      で理由を記録して再オープンしてください。
    </p>
  );
}
