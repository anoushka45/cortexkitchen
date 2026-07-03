const { chromium } = require("C:/Users/ANOUSHKA/AppData/Roaming/npm/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  await page.goto("http://localhost:3000/login");
  await page.fill('input[type="email"], input[name="email"]', "anoushka@test.com");
  await page.fill('input[type="password"], input[name="password"]', "testpass123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Fetch latest run ID via API (cookies are shared in same browser context)
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/v1/runs?limit=1", { credentials: "include" });
    return r.ok ? r.json() : { error: r.status };
  });
  console.log("runs API:", JSON.stringify(res).slice(0, 300));

  await browser.close();
})();
