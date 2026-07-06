import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToString } from "react-dom/server";

import { requireProductionConfig } from "~/lib/env";

requireProductionConfig();

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _loadContext: unknown,
) {
  const body = renderToString(<ServerRouter context={routerContext} url={request.url} />);

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");

  return new Response("<!DOCTYPE html>" + body, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
