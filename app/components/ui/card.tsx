import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "~/lib/class-names";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...props }: ContainerProps) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn("border-b border-slate-100 px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: ContainerProps) {
  return (
    <h2 className={cn("text-base font-semibold tracking-tight text-slate-950", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardContent({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}
