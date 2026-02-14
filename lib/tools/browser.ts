import { execInContainer, type ExecResult } from "@/lib/sandbox/exec";

/**
 * Browser tools: headless Chromium-based screenshot capture and interaction.
 * Runs inside the sandbox container which has Chromium pre-installed.
 */

interface BrowserResult {
  success: boolean;
  output: string;
  screenshot?: string; // base64 PNG data
}

/**
 * Take a screenshot of a URL running inside the container.
 * Uses headless Chromium to capture the page.
 */
export async function screenshot(
  containerId: string,
  url: string,
  opts: {
    width?: number;
    height?: number;
    fullPage?: boolean;
    delay?: number; // ms to wait after page load
  } = {}
): Promise<BrowserResult> {
  const { width = 1280, height = 720, fullPage = false, delay = 1000 } = opts;

  const outputPath = `/tmp/screenshot-${Date.now()}.png`;

  // Build Chromium command with flags
  const args = [
    "chromium-browser",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-software-rasterizer",
    `--window-size=${width},${height}`,
    `--screenshot=${outputPath}`,
  ];

  if (fullPage) {
    args.push("--full-page-screenshot");
  }

  args.push(url);

  // If delay is needed, wait before screenshot
  const command = delay > 0
    ? `sleep ${delay / 1000} && ${args.join(" ")} 2>&1`
    : `${args.join(" ")} 2>&1`;

  const result = await execInContainer(containerId, command, {
    timeoutMs: 30_000,
    user: "sandbox",
  });

  if (result.exitCode !== 0 && !result.stdout.includes("Written to file")) {
    return {
      success: false,
      output: `Screenshot failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
    };
  }

  // Read the screenshot file as base64
  const readResult = await execInContainer(
    containerId,
    `base64 -w 0 ${outputPath} && rm -f ${outputPath}`,
    { timeoutMs: 10_000, user: "sandbox" }
  );

  if (readResult.exitCode !== 0 || !readResult.stdout.trim()) {
    return {
      success: false,
      output: `Failed to read screenshot file: ${readResult.stderr}`,
    };
  }

  return {
    success: true,
    output: `Screenshot captured (${width}x${height}) from ${url}`,
    screenshot: readResult.stdout.trim(),
  };
}

/**
 * Navigate to a URL and extract page content (text, title, meta).
 * Useful for agents to "see" what the app looks like without a full screenshot.
 */
export async function getPageContent(
  containerId: string,
  url: string,
  opts: { timeout?: number } = {}
): Promise<BrowserResult> {
  const { timeout = 10_000 } = opts;

  // Use a Node.js script to fetch and parse page content using Chromium DevTools Protocol
  const script = `
const http = require('http');
const https = require('https');
const { URL } = require('url');

const target = new URL('${url}');
const client = target.protocol === 'https:' ? https : http;

const req = client.get(target, { timeout: ${timeout} }, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    // Extract title
    const titleMatch = body.match(/<title[^>]*>([^<]*)<\\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '(no title)';

    // Extract meta description
    const metaMatch = body.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const description = metaMatch ? metaMatch[1].trim() : '';

    // Extract visible text (rough)
    const textContent = body
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    console.log(JSON.stringify({
      title,
      description,
      status: res.statusCode,
      contentType: res.headers['content-type'] || '',
      textPreview: textContent,
      bodyLength: body.length
    }));
  });
});
req.on('error', (err) => {
  console.log(JSON.stringify({ error: err.message }));
});
req.on('timeout', () => {
  req.destroy();
  console.log(JSON.stringify({ error: 'Request timed out' }));
});
`;

  const result = await execInContainer(
    containerId,
    `node -e ${JSON.stringify(script)}`,
    { timeoutMs: timeout + 5000, user: "sandbox" }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: `Failed to fetch page: ${result.stderr || result.stdout}`,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    if (parsed.error) {
      return { success: false, output: `Page fetch error: ${parsed.error}` };
    }

    const lines = [
      `Title: ${parsed.title}`,
      `Status: ${parsed.status}`,
      `Content-Type: ${parsed.contentType}`,
      parsed.description ? `Description: ${parsed.description}` : "",
      `Body size: ${parsed.bodyLength} bytes`,
      `---`,
      `Text preview:`,
      parsed.textPreview,
    ].filter(Boolean);

    return { success: true, output: lines.join("\n") };
  } catch {
    return { success: true, output: result.stdout.trim() };
  }
}

/**
 * Check if a URL is responding (health check for dev servers).
 */
export async function checkUrl(
  containerId: string,
  url: string,
  opts: { timeout?: number } = {}
): Promise<BrowserResult> {
  const { timeout = 5000 } = opts;

  const result = await execInContainer(
    containerId,
    `curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time ${Math.ceil(timeout / 1000)} "${url}"`,
    { timeoutMs: timeout + 3000, user: "sandbox" }
  );

  const parts = result.stdout.trim().split(" ");
  const statusCode = parseInt(parts[0], 10);
  const responseTime = parts[1] ?? "?";

  if (result.exitCode !== 0 || isNaN(statusCode)) {
    return {
      success: false,
      output: `URL ${url} is not responding: ${result.stderr || "connection refused"}`,
    };
  }

  return {
    success: statusCode >= 200 && statusCode < 400,
    output: `URL ${url} responded with status ${statusCode} in ${responseTime}s`,
  };
}

/**
 * Interact with a page element using Chromium DevTools Protocol.
 * Supports click, type, and select actions.
 */
export async function interactWithPage(
  containerId: string,
  url: string,
  actions: Array<{
    action: "click" | "type" | "select" | "wait";
    selector?: string;
    value?: string;
    delay?: number;
  }>
): Promise<BrowserResult> {
  // Build a Puppeteer-like script using node and chromium
  const actionCode = actions
    .map((a, i) => {
      switch (a.action) {
        case "click":
          return `
    // Action ${i}: click ${a.selector}
    await page.click('${a.selector}');
    await page.waitForTimeout(${a.delay ?? 500});`;
        case "type":
          return `
    // Action ${i}: type into ${a.selector}
    await page.type('${a.selector}', '${(a.value ?? "").replace(/'/g, "\\'")}', { delay: 50 });
    await page.waitForTimeout(${a.delay ?? 300});`;
        case "select":
          return `
    // Action ${i}: select ${a.value} in ${a.selector}
    await page.select('${a.selector}', '${a.value ?? ""}');
    await page.waitForTimeout(${a.delay ?? 300});`;
        case "wait":
          return `
    // Action ${i}: wait ${a.delay ?? 1000}ms
    await page.waitForTimeout(${a.delay ?? 1000});`;
        default:
          return "";
      }
    })
    .join("\n");

  const script = `
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('${url}', { waitUntil: 'networkidle0', timeout: 15000 });
    ${actionCode}

    // Take screenshot after actions
    const screenshotBuffer = await page.screenshot({ encoding: 'base64' });
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));

    console.log(JSON.stringify({
      title,
      bodyText,
      screenshot: screenshotBuffer,
      actionsCompleted: ${actions.length}
    }));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  } finally {
    await browser.close();
  }
})();
`;

  const result = await execInContainer(
    containerId,
    `node -e ${JSON.stringify(script)}`,
    { timeoutMs: 45_000, user: "sandbox" }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: `Browser interaction failed: ${result.stderr || result.stdout}`,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    if (parsed.error) {
      return { success: false, output: `Interaction error: ${parsed.error}` };
    }

    return {
      success: true,
      output: `Completed ${parsed.actionsCompleted} actions on "${parsed.title}". Text preview: ${(parsed.bodyText ?? "").slice(0, 500)}`,
      screenshot: parsed.screenshot,
    };
  } catch {
    return { success: true, output: result.stdout.trim() };
  }
}
