export function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
            kosu
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            軽量なセルフホスト工数管理
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            月次の予定、日々の実績、案件別の配分を小規模チームで扱うためのOSSツールです。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400" href="/setup">
              初期セットアップ
            </a>
            <a className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900" href="/login">
              ログイン
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
