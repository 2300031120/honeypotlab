import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AppShell } from "./App.tsx";

export function render(url = "/") {
  const appHtml = renderToString(
    <StaticRouter location={url}>
      <AppShell authChecked authenticated={false} isSsr />
    </StaticRouter>
  );
  return { appHtml };
}
