import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd();
const clientIndexPath = resolve(cwd, "dist", "index.html");
const serverEntryPath = resolve(cwd, "dist-ssr", "entry-server.js");
const siteName = String(process.env.VITE_PUBLIC_SITE_NAME || "CyberSentil").trim();
const shortName = String(process.env.VITE_PUBLIC_SHORT_NAME || siteName.replace(/\s+AI$/i, "") || siteName).trim();
const tagline = String(process.env.VITE_PUBLIC_TAGLINE || "Deception-led threat detection").trim();
const siteDescription = String(
  process.env.VITE_PUBLIC_SITE_DESCRIPTION ||
    "Deception-led threat detection platform for earlier attacker visibility, preserved evidence, and AI-assisted incident context."
).trim();
const siteUrl = String(process.env.VITE_PUBLIC_SITE_URL || "http://localhost").replace(/\/+$/, "");
const suspenseFallbackMarker = "Loading secure module...";

const routeMetadata = [
  {
    route: "/",
    title: `${siteName} | ${tagline}`,
    description: siteDescription,
  },
  {
    route: "/platform",
    title: `Platform | ${siteName}`,
    description: `Explore the ${shortName} platform for deception surfaces, telemetry, replay, AI summaries, and operator workflows.`,
  },
  {
    route: "/resources",
    title: `Resources | ${siteName}`,
    description: `Technical review resources for ${shortName}, including security, integrations, deployment, and architecture.`,
  },
  {
    route: "/integrations",
    title: `Integrations | ${siteName}`,
    description: `Review the ${shortName} ingest path, edge relays, Microsoft 365 signal flow, and Splunk validation paths.`,
  },
  {
    route: "/deployment",
    title: `Deployment | ${siteName}`,
    description: `Review deployment, isolation, launch preflight, and rollout checks for ${shortName}.`,
  },
  {
    route: "/pricing",
    title: `Pricing | ${siteName}`,
    description: `Compare guided pilot, rollout, and MSSP pricing paths for ${shortName}.`,
  },
  {
    route: "/case-study",
    title: `Sample Incident | ${siteName}`,
    description: `Review a sample attacker path, analyst brief, and evidence handoff from ${shortName}.`,
  },
  {
    route: "/screenshots",
    title: `Screenshots | ${siteName}`,
    description: `Preview operator dashboards, telemetry, replay, and forensics screens from ${shortName}.`,
  },
  {
    route: "/architecture",
    title: `Architecture | ${siteName}`,
    description: `Understand how decoys, telemetry, AI summaries, and analyst workflows connect in ${shortName}.`,
  },
  {
    route: "/use-cases",
    title: `Use Cases | ${siteName}`,
    description: `See where ${shortName} fits SaaS, lean SOC, and MSSP exposed-route detection workflows.`,
  },
  {
    route: "/security",
    title: `Security | ${siteName}`,
    description: `Read the ${shortName} security posture, disclosure policy, and rollout guardrails.`,
  },
  {
    route: "/privacy",
    title: `Privacy Policy | ${siteName}`,
    description: `Review the privacy policy for ${siteName}.`,
  },
  {
    route: "/terms",
    title: `Terms of Service | ${siteName}`,
    description: `Review the current terms of service for ${siteName}.`,
  },
  {
    route: "/contact",
    title: `Contact Team | ${siteName}`,
    description: `Contact ${siteName} to discuss deception rollout, exposure mapping, and product fit for your environment.`,
  },
  {
    route: "/demo",
    title: `Request Demo | ${siteName}`,
    description: `Request a live ${siteName} walkthrough with demo-safe telemetry, decoys, replay, and analyst-ready context.`,
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceMetaContent(html, selector, content) {
  return html.replace(selector, (_match, prefix, suffix) => `${prefix}${escapeHtml(content)}${suffix}`);
}

function applySeo(html, route, meta) {
  const routeUrl = route === "/" ? siteUrl : `${siteUrl}${route}`;
  let nextHtml = html;
  nextHtml = nextHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+name="description"[^>]+content=")[^"]*("[^>]*>)/i, meta.description);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+property="og:title"[^>]+content=")[^"]*("[^>]*>)/i, meta.title);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+property="og:description"[^>]+content=")[^"]*("[^>]*>)/i, meta.description);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+property="og:url"[^>]+content=")[^"]*("[^>]*>)/i, routeUrl);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+name="twitter:title"[^>]+content=")[^"]*("[^>]*>)/i, meta.title);
  nextHtml = replaceMetaContent(nextHtml, /(<meta[^>]+name="twitter:description"[^>]+content=")[^"]*("[^>]*>)/i, meta.description);
  nextHtml = nextHtml.replace(
    /(<link[^>]+rel="canonical"[^>]+href=")[^"]*("[^>]*>)/i,
    `$1${escapeHtml(routeUrl)}$2`
  );
  return nextHtml;
}

function outputPathForRoute(route) {
  if (route === "/") {
    return clientIndexPath;
  }
  return resolve(cwd, "dist", route.replace(/^\/+/, ""), "index.html");
}

const { render } = await import(pathToFileURL(serverEntryPath).href);
const html = await readFile(clientIndexPath, "utf8");
const rootTag = '<div id="root"></div>';
if (!html.includes(rootTag)) {
  throw new Error("Unable to locate root tag in dist/index.html.");
}

for (const item of routeMetadata) {
  const { appHtml } = await render(item.route);
  const canInjectAppHtml =
    typeof appHtml === "string" && appHtml.trim() && !appHtml.includes(suspenseFallbackMarker);
  const hydratedHtml = canInjectAppHtml ? html.replace(rootTag, `<div id="root">${appHtml}</div>`) : html;
  const outputPath = outputPathForRoute(item.route);
  const finalHtml = applySeo(hydratedHtml, item.route, item);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, finalHtml, "utf8");
}
