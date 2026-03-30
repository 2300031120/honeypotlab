import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd();
const clientIndexPath = resolve(cwd, "dist", "index.html");
const serverEntryPath = resolve(cwd, "dist-ssr", "entry-server.js");

const { render } = await import(pathToFileURL(serverEntryPath).href);
const { appHtml } = await render("/");

if (!appHtml || typeof appHtml !== "string") {
  throw new Error("SSR render returned empty markup.");
}

const html = await readFile(clientIndexPath, "utf8");
const rootTag = '<div id="root"></div>';
if (!html.includes(rootTag)) {
  throw new Error("Unable to locate root tag in dist/index.html.");
}

const hydratedHtml = html.replace(rootTag, `<div id="root">${appHtml}</div>`);
await writeFile(clientIndexPath, hydratedHtml, "utf8");
