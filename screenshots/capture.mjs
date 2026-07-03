import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto("http://localhost:3000/dashboard");
await page.fill('input[type="email"], input[name="email"]', "treksandtrips4303@gmail.com");
await page.fill('input[type="password"], input[name="password"]', "testpass123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 10000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: "screenshots/dashboard_fullpage.png", fullPage: true });
console.log("done");
await browser.close();
