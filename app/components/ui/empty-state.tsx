type EmptyStateProps = {
  actionLabel?: string;
  description: string;
  title: string;
};

export function EmptyState({ actionLabel, description, title }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {actionLabel ? (
        <p className="mt-5 text-sm font-medium text-sky-700">{actionLabel}</p>
      ) : null}
    </section>
  );
}
