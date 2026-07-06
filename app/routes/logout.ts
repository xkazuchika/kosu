import { redirect } from "react-router";
import type { Route } from "./+types/logout";

import { createDatabaseConnection } from "~/db/client";
import { deleteSession } from "~/db/repositories/sessions";
import { getSessionCookie } from "~/services/session";
import { clearSessionCookie } from "~/services/session";

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const sessionId = getSessionCookie(request);

    if (sessionId) {
      deleteSession(db, sessionId);
    }

    return redirect("/login", {
      headers: { "Set-Cookie": clearSessionCookie() },
    });
  } finally {
    sqlite.close();
  }
};
