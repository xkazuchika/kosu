import type { ReactNode } from "react";

import { cn } from "~/lib/class-names";

type BadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

const toneClasses: Record<BadgeTone, string> = {
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-indigo-200 bg-indigo-50 text-indigo-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
