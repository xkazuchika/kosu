type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "読み込み中" }: LoadingStateProps) {
  return (
    <div
      aria-label={label}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
      role="status"
    >
      <span className="size-3 animate-pulse rounded-full bg-sky-500" />
      <span>{label}</span>
    </div>
  );
}
