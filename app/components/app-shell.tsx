import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Banknote,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardList,
  FolderKanban,
  Gauge,
  Home,
  Import,
  Menu,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from "lucide-react";

import { cn } from "~/lib/class-names";

type Role = "admin" | "member";

type AppShellProps = {
  children: ReactNode;
  currentPath?: string;
  role: Role;
  userName: string;
};

type NavigationSection = {
  items: { href: string; icon: LucideIcon; label: string }[];
  label: string;
};

const memberNavigation: NavigationSection[] = [
  { label: "Home", items: [{ href: "/dashboard", icon: Home, label: "ダッシュボード" }] },
  {
    label: "Actual",
    items: [
      { href: "/work-logs", icon: ClipboardList, label: "日別工数実績入力" },
      { href: "/work-logs/month", icon: CalendarClock, label: "月別総稼働時間入力" },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/daily-plans", icon: ChartNoAxesCombined, label: "日別予定工数入力" },
      { href: "/monthly-plans", icon: Gauge, label: "月次予定工数" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/reports/planned-vs-actual", icon: BarChart3, label: "予定工数対実績工数" },
      { href: "/reports", icon: ChartNoAxesCombined, label: "工数実績レポート" },
    ],
  },
  {
    label: "Projects",
    items: [
      { href: "/projects", icon: FolderKanban, label: "担当案件" },
      { href: "/self-assign", icon: UserRoundPlus, label: "自己アサイン" },
    ],
  },
];

const administratorNavigation: NavigationSection[] = [
  { label: "Home", items: [{ href: "/dashboard", icon: Home, label: "ダッシュボード" }] },
  {
    label: "Actual",
    items: [
      { href: "/work-logs", icon: ClipboardList, label: "日別工数実績入力" },
      { href: "/work-logs/month", icon: CalendarClock, label: "月別総稼働時間入力" },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/daily-plans", icon: ChartNoAxesCombined, label: "日別予定工数入力" },
      { href: "/monthly-plans/admin", icon: Gauge, label: "月次予定工数入力" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/reports/planned-vs-actual", icon: BarChart3, label: "予定工数対実績工数" },
      { href: "/reports", icon: ChartNoAxesCombined, label: "工数実績レポート" },
      { href: "/reports/project-financials", icon: Banknote, label: "案件財務レビュー" },
    ],
  },
  {
    label: "Projects",
    items: [
      { href: "/projects", icon: FolderKanban, label: "案件管理" },
      { href: "/self-assign", icon: UserRoundPlus, label: "自己アサイン" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/period-locks", icon: ShieldCheck, label: "月次原価締め" },
      { href: "/members", icon: Users, label: "メンバー" },
      { href: "/imports", icon: Import, label: "インポート" },
      { href: "/settings", icon: Settings, label: "設定" },
    ],
  },
];

export function AppShell({ children, currentPath = "/dashboard", role, userName }: AppShellProps) {
  const navigation = role === "admin" ? administratorNavigation : memberNavigation;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-200/80 bg-white/95 px-4 py-6 shadow-[1px_0_0_rgba(15,23,42,0.02)] md:flex">
        <div className="shrink-0">
          <Brand />
        </div>
        <Navigation currentPath={currentPath} navigation={navigation} />
      </aside>

      <div className="md:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workspace</p>
              <p className="text-sm font-medium text-slate-700">セルフホスト工数管理</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">
                {userName}
              </div>
              <form action="/logout" method="post">
                <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" type="submit">
                  ログアウト
                </button>
              </form>
            </div>
          </div>
          <MobileNavigation currentPath={currentPath} navigation={navigation} />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="inline-flex items-center gap-2 rounded-xl text-slate-950" href="/dashboard">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm shadow-indigo-900/20">k</span>
      <span>
        <span className={cn("block font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>kosu</span>
        {!compact ? <span className="block text-xs font-medium text-slate-500">Effort workspace</span> : null}
      </span>
    </a>
  );
}

function Navigation({ currentPath, navigation }: { currentPath: string; navigation: NavigationSection[] }) {
  return (
    <nav aria-label="メインナビゲーション" className="mt-8 min-h-0 flex-1 space-y-6 overflow-y-auto pb-4 pr-1">
      {navigation.map((section) => (
        <section key={section.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.label}</p>
          <div className="mt-2 grid gap-1">
            {section.items.map((item) => (
              <NavigationLink currentPath={currentPath} item={item} key={item.href} />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

function MobileNavigation({ currentPath, navigation }: { currentPath: string; navigation: NavigationSection[] }) {
  return (
    <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 marker:hidden">
        <span className="inline-flex items-center gap-2">
          <Menu aria-hidden className="h-4 w-4 text-slate-500" />
          Menu
        </span>
        <span className="text-xs font-medium text-slate-400">Actual / Plan / Analyze</span>
      </summary>
      <div className="grid gap-4 px-1 pb-2 pt-3">
        {navigation.map((section) => (
          <section key={section.label}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.label}</p>
            <div className="mt-1 grid gap-1">
              {section.items.map((item) => (
                <NavigationLink currentPath={currentPath} item={item} key={item.href} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

function NavigationLink({ currentPath, item }: { currentPath: string; item: NavigationSection["items"][number] }) {
  const active = isActiveNavigationItem(currentPath, item.href);
  const Icon = item.icon;

  return (
    <a
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative inline-flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-indigo-50 text-indigo-950 ring-1 ring-inset ring-indigo-100 before:absolute before:left-0 before:top-2 before:h-5 before:w-1 before:rounded-r-full before:bg-indigo-500"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
      href={item.href}
    >
      <Icon aria-hidden className={cn("h-4 w-4 shrink-0", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
      <span>{item.label}</span>
    </a>
  );
}

function isActiveNavigationItem(currentPath: string, href: string) {
  if (currentPath === href) return true;
  if (href === "/work-logs") return /^\/work-logs\/\d{4}-\d{2}-\d{2}$/.test(currentPath);
  if (href === "/projects") return currentPath.startsWith("/projects/");
  if (href === "/members") return currentPath.startsWith("/members/");
  if (href === "/monthly-plans/admin") return currentPath.startsWith("/monthly-plans/admin");
  return false;
}
