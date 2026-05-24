const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ARTIFACTS_DIR = "/Users/howichok/.gemini/antigravity/brain/ea35dee1-d933-491f-aa5a-21921f84e2a1";

async function scrollPage(page) {
  // Get scroll height
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = 720;
  console.log(`Page scroll height: ${scrollHeight}px`);
  
  let currentScroll = 0;
  // Scroll down step-by-step to trigger transitions
  while (currentScroll < scrollHeight - viewportHeight) {
    currentScroll += 120;
    await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
    await page.waitForTimeout(80); // Smooth scroll simulation
  }
  
  // Wait at the bottom
  await page.waitForTimeout(1000);
  
  // Scroll back up to see entry/exit effects
  while (currentScroll > 0) {
    currentScroll -= 240;
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, currentScroll));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1000);
}

async function recordSite(url, filename) {
  console.log(`Recording site: ${url} ...`);
  const browser = await chromium.launch({ headless: true });
  
  // Enable video recording in the browser context
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: ARTIFACTS_DIR,
      size: { width: 1280, height: 720 }
    }
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    console.log(`Loaded ${url}. Starting scroll animation...`);
    
    // Perform scroll and interactive wait
    await scrollPage(page);
    
    console.log(`Finished scrolling ${url}.`);
  } catch (err) {
    console.error(`Error recording ${url}:`, err);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    
    if (video) {
      const videoPath = await video.path();
      const targetPath = path.join(ARTIFACTS_DIR, filename);
      fs.renameSync(videoPath, targetPath);
      console.log(`Video saved to ${targetPath}`);
    } else {
      console.warn(`No video captured for ${url}`);
    }
  }
}

(async () => {
  console.log("Starting animation recording pipeline...");
  
  // 1. Record Apple
  await recordSite("https://www.apple.com/", "apple_animation.webm");
  
  // 2. Record Google Chrome
  await recordSite("https://www.google.com/chrome/", "chrome_animation.webm");
  
  // 3. Record our local development server (Antigravity portal landing page)
  await recordSite("http://localhost:3000/", "antigravity_animation.webm");
  
  console.log("All recordings finished!");
})();
