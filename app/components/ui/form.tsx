import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement, useId } from "react";

import { cn } from "~/lib/class-names";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>;
  error?: string;
  help?: ReactNode;
  label: string;
};

export function Field({ children, error, help, label }: FieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const descriptionId = error || help ? `${id}-description` : undefined;

  const input = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": descriptionId,
        "aria-invalid": children.props["aria-invalid"] ?? Boolean(error),
        id,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      {input}
      {error ? (
        <p className="text-sm text-red-700" id={descriptionId}>
          {error}
        </p>
      ) : help ? (
        <p className="text-sm text-slate-500" id={descriptionId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
