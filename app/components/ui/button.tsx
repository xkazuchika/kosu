import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "~/lib/class-names";

type ButtonVariant = "danger" | "ghost" | "outline" | "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  leadingIcon?: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600",
  ghost: "bg-transparent text-slate-700 shadow-none hover:bg-slate-100 focus-visible:outline-slate-500",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-indigo-600",
  primary: "bg-indigo-600 text-white shadow-indigo-900/10 hover:bg-indigo-700 focus-visible:outline-indigo-600",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900",
};

export function Button({ children, className, leadingIcon, type = "button", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>{leadingIcon}</span> : null}
      {children}
    </button>
  );
}
