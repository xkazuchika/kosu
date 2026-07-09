import { Outlet, redirect, useLoaderData, useLocation } from "react-router";

import { AppShell } from "~/components/app-shell";
import { createDatabaseConnection } from "~/db/client";
import { getSessionMember } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      return redirect("/login");
    }

    return { member };
  } finally {
    sqlite.close();
  }
};

export default function AppLayout() {
  const { member } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppShell
      currentPath={location.pathname}
      role={member.role}
      userName={member.displayName}
    >
      <Outlet />
    </AppShell>
  );
}
