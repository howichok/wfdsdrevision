import { createStealthPage } from "./stealth";
import type { Cookie } from "playwright";
import { db } from "@/lib/db";
import { scrapedTeamsData } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export interface ScrapedTeamsMessage {
  id: string; // Teams message ID
  sender: string;
  content: string;
  timestamp: string;
  attachments: {
    fileName: string;
    url: string;
    type: string;
  }[];
}

/**
 * Normalizes user-submitted cookies into a format Playwright expects.
 */
function normalizeCookies(rawCookies: any): Cookie[] {
  const parsed = typeof rawCookies === "string" ? JSON.parse(rawCookies) : rawCookies;
  if (!Array.isArray(parsed)) {
    throw new Error("Cookies must be a JSON array of cookie objects");
  }

  return parsed.map((c: any) => {
    // Playwright requires domain, name, value, path.
    // Ensure all values are strings or correct types.
    const normalized = {
      name: String(c.name || c.key),
      value: String(c.value),
      domain: String(c.domain),
      path: String(c.path || "/"),
      httpOnly: typeof c.httpOnly === "boolean" ? c.httpOnly : false,
      secure: typeof c.secure === "boolean" ? c.secure : true,
      sameSite: (c.sameSite as any) || "Lax",
    } as any;

    if (typeof c.expires === "number") {
      normalized.expires = c.expires;
    }

    return normalized as Cookie;
  });
}

/**
 * Connects to Microsoft Teams using the user's cookies, navigates to a channel URL,
 * and scrapes message logs and attachment details.
 */
export async function scrapeTeamsChannel({
  channelUrl,
  cookies,
  maxMessages = 15,
}: {
  channelUrl: string;
  cookies: any;
  maxMessages?: number;
}): Promise<ScrapedTeamsMessage[]> {
  const { page, close } = await createStealthPage();

  try {
    const playCookies = normalizeCookies(cookies);
    // Add cookies to the browser context
    await page.context().addCookies(playCookies);

    console.log(`Navigating to Teams Channel: ${channelUrl}`);
    // Navigate directly to the Teams channel
    await page.goto(channelUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Wait for the main Teams application layout to load
    // Teams v2 uses several markers like 'div[role="main"]', 'div[class*="message"]', etc.
    try {
      await page.waitForSelector('div[class*="message"], div[role="listitem"], .message-body, iframe', {
        timeout: 20_000,
      });
    } catch (e) {
      console.log("Warning: Specific message selectors not loaded. Attempting to parse DOM directly.");
    }

    // Wait a brief moment for dynamic client-side react components to render
    await page.waitForTimeout(3000);

    // Evaluate in browser to extract messages
    const messages = await page.evaluate(
      ({ maxMsgCount }) => {
        // Teams v2 renders messages in divs with role="presentation" or class names containing "message"
        // Let's find all potential message containers
        const containers = Array.from(document.querySelectorAll('div[class*="message"], div[class*="post"], div[role="listitem"]'))
          .filter((el) => {
            // Filter out utility lists, headers, menus, or empty containers
            const textLength = (el as HTMLElement).innerText?.trim().length || 0;
            return textLength > 20 && el.querySelector('[class*="body"], [class*="content"], [data-tid="message-body"]');
          })
          .slice(-maxMsgCount); // Get the most recent ones

        return containers.map((container, index) => {
          const element = container as HTMLElement;

          // 1. Try to find the sender's name
          const senderEl = element.querySelector(
            'h3, [class*="author"], [class*="sender"], [class*="name"], [data-tid="message-author"]'
          );
          const sender = senderEl ? (senderEl as HTMLElement).innerText.trim() : "Unknown Teacher";

          // 2. Try to find the message body content
          const bodyEl = element.querySelector(
            '[class*="body"], [class*="content"], [data-tid="message-body"]'
          );
          const content = bodyEl ? (bodyEl as HTMLElement).innerText.trim() : element.innerText.trim();

          // 3. Generate or find a unique message identifier
          const messageIdAttr = element.getAttribute("data-prefixed-id") || element.getAttribute("id");
          const id = messageIdAttr || `scraped-msg-${Date.now()}-${index}`;

          // 4. Try to parse attachment links (SharePoint / OneDrive / Teams CDN)
          const links = Array.from(element.querySelectorAll("a[href]"));
          const attachments = links
            .map((link) => {
              const a = link as HTMLAnchorElement;
              const href = a.href;
              const text = a.innerText.trim();

              // Filter links that represent files (e.g. contains docx, pdf, xlsx, pptx, or sharepoint/onedrive paths)
              const isFile =
                /\.(pdf|docx|doc|pptx|ppt|xlsx|xls|txt|png|jpg|jpeg|zip)$/i.test(href) ||
                /\.(pdf|docx|doc|pptx|ppt|xlsx|xls|txt|png|jpg|jpeg|zip)$/i.test(text) ||
                href.includes("sharepoint.com") ||
                href.includes("onedrive.live.com") ||
                a.querySelector('[class*="file"], [class*="attachment"]');

              if (isFile && href && text) {
                return {
                  fileName: text.split("\n")[0] || "Attachment",
                  url: href,
                  type: href.split(".").pop()?.split("?")[0] || "unknown",
                };
              }
              return null;
            })
            .filter((att): att is { fileName: string; url: string; type: string } => att !== null);

          // 5. Try to parse timestamp
          const timeEl = element.querySelector('time, [class*="timestamp"], [class*="time"]');
          const timestamp = timeEl ? (timeEl as HTMLElement).getAttribute("datetime") || (timeEl as HTMLElement).innerText : new Date().toISOString();

          return {
            id,
            sender,
            content,
            timestamp,
            attachments,
          };
        });
      },
      { maxMsgCount: maxMessages }
    );

    return messages;
  } finally {
    await close();
  }
}

/**
 * Downloads a file attachment directly using the user's authenticated context.
 * Useful for grabbing PDF/DOCX homework sheets from Teams or SharePoint links.
 */
export async function downloadTeamsAttachment({
  fileUrl,
  cookies,
}: {
  fileUrl: string;
  cookies: any;
}): Promise<ArrayBuffer> {
  const { page, close } = await createStealthPage();

  try {
    const playCookies = normalizeCookies(cookies);
    await page.context().addCookies(playCookies);

    console.log(`Downloading attachment from: ${fileUrl}`);

    // We navigate to the file, and intercept the download event or wait for response
    // For SharePoint/OneDrive file viewer links, navigate to them and click Download if necessary,
    // or trigger direct fetch.
    const responsePromise = page.waitForResponse((response) => {
      const headers = response.headers();
      return (
        response.status() === 200 &&
        (headers["content-type"]?.includes("application/") ||
          headers["content-disposition"]?.includes("attachment"))
      );
    }, { timeout: 30_000 }).catch(() => null);

    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 30_000 });

    // Fallback: If it did not immediately download, try to fetch it in browser context using cookies
    const buffer = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        // Send it back as a base64 string because playwright evaluate cannot transfer ArrayBuffer easily
        const bytes = new Uint8Array(ab);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      } catch (err) {
        return null;
      }
    }, fileUrl);

    if (buffer) {
      const binaryString = atob(buffer);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    const response = await responsePromise;
    if (response) {
      const buf = await response.body();
      // Convert Node Buffer to ArrayBuffer
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }

    throw new Error("Failed to download attachment - could not intercept download or fetch.");
  } finally {
    await close();
  }
}

/**
 * High-level service that scrapes Teams and saves new posts to `scraped_teams_data`.
 */
export async function ingestTeamsData({
  channelUrl,
  cookies,
  userId,
}: {
  channelUrl: string;
  cookies: any;
  userId: string;
}) {
  console.log(`Ingesting Teams messages for user ${userId} from ${channelUrl}`);
  
  // 1. Scrape the latest channel messages
  const messages = await scrapeTeamsChannel({
    channelUrl,
    cookies,
    maxMessages: 20, // Crawl a reasonable history
  });

  if (messages.length === 0) {
    console.log("No messages scraped.");
    return { success: true, count: 0 };
  }

  let newCount = 0;

  // 2. Iterate and insert non-duplicate messages
  for (const msg of messages) {
    const contentToSave = `[From: ${msg.sender}] ${msg.content}`.trim();
    if (!contentToSave) continue;

    // Check if duplicate exists
    const existing = await db.query.scrapedTeamsData.findFirst({
      where: and(
        eq(scrapedTeamsData.channelId, channelUrl),
        eq(scrapedTeamsData.content, contentToSave)
      ),
    });

    if (existing) {
      console.log(`Skipping duplicate message content from ${msg.sender}`);
      continue;
    }

    await db.insert(scrapedTeamsData).values({
      content: contentToSave,
      channelId: channelUrl,
      processed: false,
    });

    newCount++;
  }

  console.log(`Ingested ${newCount} new messages into scraped_teams_data.`);
  return { success: true, count: newCount };
}
