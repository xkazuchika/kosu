import type { ReactNode } from "react";

import { cn } from "~/lib/class-names";

type ToastTone = "danger" | "info" | "success" | "warning";

type ToastProps = {
  children?: ReactNode;
  title: string;
  tone?: ToastTone;
};

const toneClasses: Record<ToastTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Toast({ children, title, tone = "success" }: ToastProps) {
  return (
    <div className={cn("rounded-xl border p-4 shadow-lg", toneClasses[tone])} role="status">
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm leading-6">{children}</div> : null}
    </div>
  );
}
