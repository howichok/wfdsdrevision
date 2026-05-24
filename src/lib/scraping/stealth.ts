// SERVER ONLY — never import in client components or edge routes

export async function createStealthPage() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();
  return { page, close: () => browser.close() };
}

export async function scrapeUrl(url: string): Promise<{ html: string; text: string }> {
  const { page, close } = await createStealthPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const html = await page.content();
    const text = await page.evaluate(
      () => (document.body as HTMLElement).innerText
    );
    return { html, text };
  } finally {
    await close();
  }
}
