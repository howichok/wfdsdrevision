const { chromium } = require("playwright");

(async () => {
  console.log("Launching browser...");
  try {
    const browser = await chromium.launch({ headless: true });
    console.log("Browser launched successfully!");
    await browser.close();
  } catch (err) {
    console.error("Failed to launch browser:", err);
  }
})();
