type EmptyStateProps = {
  actionLabel?: string;
  actionHref?: string;
  description: string;
  title: string;
};

export function EmptyState({ actionHref, actionLabel, description, title }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {actionLabel ? (
        actionHref ? (
          <a className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700" href={actionHref}>
            {actionLabel}
          </a>
        ) : (
          <p className="mt-5 text-sm font-semibold text-indigo-700">{actionLabel}</p>
        )
      ) : null}
    </section>
  );
}
