import type { ReactNode } from "react";

type Role = "admin" | "member";

type AppShellProps = {
  children: ReactNode;
  role: Role;
  userName: string;
};

const memberNavigation = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/work-logs", label: "工数入力" },
  { href: "/monthly-plans", label: "月次予定" },
  { href: "/projects", label: "担当案件" },
  { href: "/self-assign", label: "自己アサイン" },
  { href: "/reports", label: "レポート" },
  { href: "/reports/planned-vs-actual", label: "予定対実績" },
];

const administratorNavigation = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/work-logs", label: "工数入力" },
  { href: "/monthly-plans/admin", label: "月次予定入力" },
  { href: "/projects", label: "案件" },
  { href: "/self-assign", label: "自己アサイン" },
  { href: "/members", label: "メンバー" },
  { href: "/reports", label: "レポート" },
  { href: "/reports/planned-vs-actual", label: "予定対実績" },
  { href: "/imports", label: "インポート" },
  { href: "/settings", label: "設定" },
];

export function AppShell({ children, role, userName }: AppShellProps) {
  const navigation = role === "admin" ? administratorNavigation : memberNavigation;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-6 md:block">
        <a className="text-lg font-semibold tracking-tight" href="/dashboard">
          kosu
        </a>
        <nav aria-label="メインナビゲーション" className="mt-8 grid gap-1">
          {navigation.map((item) => (
            <a
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">セルフホスト工数管理</p>
              <p className="text-xl font-semibold tracking-tight">kosu</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                {userName}
              </div>
              <form action="/logout" method="post">
                <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="submit">
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
