import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "~/lib/class-names";

type ButtonVariant = "danger" | "ghost" | "outline" | "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-sky-600",
  primary: "bg-sky-700 text-white hover:bg-sky-800 focus-visible:outline-sky-700",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900",
};

export function Button({ children, className, type = "button", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
