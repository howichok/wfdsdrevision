export interface ParsedDevice {
  browser: string;
  os: string;
  deviceLabel: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedDevice {
  const ua = userAgent ?? "";
  const lower = ua.toLowerCase();

  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("cros")) os = "ChromeOS";

  let browser = "Unknown Browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browser = "Safari";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";

  let deviceType: ParsedDevice["deviceType"] = "desktop";
  if (lower.includes("mobile")) deviceType = "mobile";
  else if (lower.includes("tablet") || lower.includes("ipad")) deviceType = "tablet";
  else if (!ua) deviceType = "unknown";

  return {
    browser,
    os,
    deviceLabel: `${browser} on ${os}`,
    deviceType,
  };
}

export function buildDeviceFingerprint(
  userAgent: string | null | undefined,
  ipAddress: string | null | undefined
): string {
  const parsed = parseUserAgent(userAgent);
  const ipPrefix = ipAddress?.split(".").slice(0, 3).join(".") ?? "unknown-ip";
  return `${parsed.browser}|${parsed.os}|${ipPrefix}`.toLowerCase();
}
