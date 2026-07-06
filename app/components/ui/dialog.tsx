import type { ReactNode } from "react";

type DialogProps = {
  children?: ReactNode;
  description?: string;
  open: boolean;
  title: string;
};

export function Dialog({ children, description, open, title }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div aria-label={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
