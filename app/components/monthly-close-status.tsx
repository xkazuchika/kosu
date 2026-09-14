import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";

type Status = "open" | "in_review" | "confirmed" | "approved";
const statusLabels: Record<Status, string> = {
  open: "工数未確定",
  in_review: "工数レビュー中",
  confirmed: "工数確定済み",
  approved: "原価承認済み",
};

export function MonthlyCloseStatusBadge({
  month,
  status,
  kind = "effort",
}: {
  month?: string;
  status: Status;
  kind?: "effort" | "cost";
}) {
  const tone =
    status === "open"
      ? "success"
      : status === "in_review"
        ? "warning"
        : "neutral";
  const label =
    kind === "cost"
      ? {
          open: "原価未確認",
          in_review: "原価レビュー中",
          approved: "原価承認済み",
          confirmed: "原価未確認",
        }[status]
      : statusLabels[status];
  return (
    <Badge tone={tone}>
      {month ? `${month} · ` : ""}
      {label}
    </Badge>
  );
}

export function MonthlyCloseReadOnlyNotice({
  month,
  status,
}: {
  month: string;
  status: Status;
}) {
  if (status === "open") return null;

  return (
    <p
      className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
      role="status"
    >
      {month} は「{statusLabels[status]}」のため閲覧のみです。修正する場合は
      <Link
        className="font-semibold text-indigo-700 hover:underline"
        to={`/period-locks?month=${month}`}
      >
        月次締め
      </Link>
      で理由を記録して再オープンしてください。
    </p>
  );
}
