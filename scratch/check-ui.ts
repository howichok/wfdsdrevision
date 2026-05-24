import { chromium } from "playwright";

async function main() {
  console.log("Starting browser check...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Log browser console output and page-level errors
  page.on("pageerror", (err) => {
    console.error("❌ BROWSER EXCEPTION:", err.message);
    if (err.stack) console.error(err.stack);
  });
  
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error") {
      console.error("❌ BROWSER CONSOLE ERROR:", msg.text());
    } else if (type === "warning") {
      console.warn("⚠️ BROWSER CONSOLE WARN:", msg.text());
    } else {
      console.log("ℹ️ BROWSER CONSOLE LOG:", msg.text());
    }
  });

  const routes = [
    { name: "Dashboard", url: "http://localhost:3000/dashboard" },
    { name: "Lessons", url: "http://localhost:3000/lessons" },
    { name: "Exam Prep", url: "http://localhost:3000/exam-prep" },
    { name: "Canvas", url: "http://localhost:3000/canvas" },
    { name: "Revision", url: "http://localhost:3000/revision" },
    { name: "Teams Sync", url: "http://localhost:3000/teams" }
  ];

  for (const route of routes) {
    console.log(`\n--------------------------------------------`);
    console.log(`Checking ${route.name} (${route.url})...`);
    try {
      const response = await page.goto(route.url, { waitUntil: "networkidle", timeout: 10000 });
      console.log(`Response Status: ${response?.status()}`);
      
      // Wait a moment for any client-side effects / hydration
      await page.waitForTimeout(2000);
      
      const title = await page.title();
      console.log(`Page Title: "${title}"`);
      
      const text = await page.locator("body").innerText();
      console.log(`Body text snippet (first 300 chars):\n${text.slice(0, 300).trim()}`);
      
      const screenshotPath = `/Users/howichok/howi/wfrevdsd/scratch/${route.name.toLowerCase().replace(" ", "_")}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot captured: ${screenshotPath}`);
    } catch (e: any) {
      console.error(`❌ Failed to check ${route.name}:`, e.message || e);
    }
  }

  await browser.close();
  console.log("\nBrowser check complete.");
}

main().catch((err) => {
  console.error("Main execution failed:", err);
});
