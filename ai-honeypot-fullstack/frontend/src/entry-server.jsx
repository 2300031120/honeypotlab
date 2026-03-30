import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AppShell } from "./App.jsx";

export function render(url = "/") {
  const appHtml = renderToString(
    <StaticRouter location={url}>
      <AppShell authenticated={false} isSsr />
    </StaticRouter>
  );
  return { appHtml };
}
