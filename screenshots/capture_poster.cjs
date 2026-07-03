const { chromium } = require("C:/Users/ANOUSHKA/AppData/Roaming/npm/node_modules/playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1350 });

  const file = "file:///" + path.resolve(__dirname, "../poster_observability.html").replace(/\\/g, "/");
  await page.goto(file);
  await page.waitForTimeout(2000); // let fonts + images load

  await page.screenshot({
    path: path.resolve(__dirname, "poster_observability.png"),
    clip: { x: 0, y: 0, width: 1080, height: 1350 },
  });
  console.log("done");
  await browser.close();
})();
