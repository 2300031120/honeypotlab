const CAMPAIGN_QUERY_KEYS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "campaign",
]);

function isExternalOrProtocolPath(targetPath: string) {
  return /^(?:[a-z]+:)?\/\//i.test(targetPath) || /^[a-z]+:/i.test(targetPath);
}

export function buildCampaignAwarePath(targetPath: string, sourceSearch = "") {
  const safeTargetPath = String(targetPath || "").trim();
  if (!safeTargetPath || isExternalOrProtocolPath(safeTargetPath)) {
    return safeTargetPath;
  }

  const [targetWithoutHash, hashFragment] = safeTargetPath.split("#", 2);
  const [pathname, targetQuery = ""] = targetWithoutHash.split("?", 2);
  const targetParams = new URLSearchParams(targetQuery);
  const sourceParams = new URLSearchParams(String(sourceSearch || "").replace(/^\?/, ""));

  let mutated = false;
  CAMPAIGN_QUERY_KEYS.forEach((key) => {
    if (targetParams.has(key)) {
      return;
    }
    const value = sourceParams.get(key);
    if (!value) {
      return;
    }
    targetParams.set(key, value);
    mutated = true;
  });

  if (!mutated) {
    return safeTargetPath;
  }

  const mergedQuery = targetParams.toString();
  const mergedPath = mergedQuery ? `${pathname}?${mergedQuery}` : pathname;
  return hashFragment !== undefined ? `${mergedPath}#${hashFragment}` : mergedPath;
}

export { CAMPAIGN_QUERY_KEYS };
