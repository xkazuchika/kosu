import type { ReactNode } from "react";

import { cn } from "~/lib/class-names";

type StatusTone = "danger" | "info" | "success" | "warning";

type StatusMessageProps = {
  children: ReactNode;
  title: string;
  tone?: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const toneLabels: Record<StatusTone, string> = {
  danger: "エラー",
  info: "情報",
  success: "完了",
  warning: "警告",
};

export function StatusMessage({ children, title, tone = "info" }: StatusMessageProps) {
  return (
    <div className={cn("rounded-xl border p-4", toneClasses[tone])} role={tone === "danger" ? "alert" : "status"}>
      <p className="text-xs font-semibold uppercase tracking-wide">{toneLabels[tone]}</p>
      <h2 className="mt-1 text-sm font-semibold">{title}</h2>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}
