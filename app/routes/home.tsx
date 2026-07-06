import type { Route } from "./+types/home";

import { LandingPage } from "~/components/landing-page";

export const meta: Route.MetaFunction = () => [
  { title: "kosu" },
  {
    name: "description",
    content: "小規模チーム向けの軽量なセルフホストOSS工数管理ツール",
  },
];

export default function Home() {
  return <LandingPage />;
}
