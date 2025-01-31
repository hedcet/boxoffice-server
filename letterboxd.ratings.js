const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");

const ltrbxd_slug = "ponman";

const height = 720;
const width = 576;

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

(async () => {
  const [config] = configs.filter((i) => i.ltrbxd_slug === ltrbxd_slug);
  if (!config) throw new Error("invalid ltrbxd_slug");

  // html generation
  const html_path = path.resolve(__dirname, "./ratings.html");
  const html = fs.existsSync(html_path)
    ? fs.readFileSync(html_path, "utf8")
    : "";
  fs.writeFileSync(
    `${html_path}.html`,
    String.raw({ raw: html.split("$?") }, [JSON.stringify(config)])
  );

  // screen-record
  const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--lang=en-IN,en",
      "--no-sandbox",
      `--window-size=${width},${height}`,
    ],
    defaultViewport: { height, width },
    headless: false,
  });
  const [page] = await browser.pages();
  const recorder = new PuppeteerScreenRecorder(page, {
    // autopad: { color: "black" },
    aspectRatio: "4:5",
    fps: 60,
    videoFrame: { height, width },
  });
  await page.goto(`file:///${path.resolve(__dirname, "./ratings.html.html")}`);
  await recorder.start("./store/ratings.mp4");
  await new Promise((r) => setTimeout(r, 1000 * 5));
  await recorder.stop();
  await browser.close();
})();
