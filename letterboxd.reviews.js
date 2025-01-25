const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { round, sample, uniqueId } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const puppeteer = require("puppeteer");
const sharp = require("sharp");

const { executablePath, local, proxy } = require("./config/env.js");
const { getOrdinalSuffix } = require("./config/misc.js");
const { db } = require("./config/nedb.js");

const json_path = path.resolve(__dirname, "./store/data.json");
const json = fs.existsSync(json_path)
  ? JSON.parse(fs.readFileSync(json_path, "utf8"))
  : {};

(async () => {
  let image = "";
  const github_folder = "DominicAndTheLadiesPurse";
  const letterboxd_page = 1;
  const letterboxd_slug = "dominic-and-the-ladies-purse";

  const images = [];
  for (const { id } of await db.find({ name: github_folder }))
    if (json[id]) images.push(...(json[id].images || []));

  const browser = await puppeteer.launch({
    args: ["--disable-setuid-sandbox", "--lang=en-IN,en", "--no-sandbox"],
    executablePath,
    headless: false,
  });
  for (let i = 0; i < 2; i++) {
    const pages = await browser.pages();
    const page = pages[i] ? pages[i] : await browser.newPage();
    await page.emulate(puppeteer.devices["iPhone 12"]);
  }

  const [page] = await browser.pages();
  await page.bringToFront();
  await page.goto(`https://letterboxd.com/film/${letterboxd_slug}`, {
    timeout: 60000,
    waitUntil: "networkidle2",
  });

  const ratings = await page.evaluate(
    (selectors) => {
      const r = {};
      for (const [k, v] of Object.entries(selectors)) {
        const e = document.querySelector(v);
        if (e) {
          const [count] = e.innerText.match(/([0-9,.%]+)/g);
          r[k] = +count.replace(/[^0-9.]+/g, "");
        }
      }
      return r;
    },
    {
      "½": 'a[href*="/rated/%C2%BD/"]',
      "★": 'a[href*="/rated/1/"]',
      "★½": 'a[href*="/rated/1%C2%BD/"]',
      "★★": 'a[href*="/rated/2/"]',
      "★★½": 'a[href*="/rated/2%C2%BD/"]',
      "★★★": 'a[href*="/rated/3/"]',
      "★★★½": 'a[href*="/rated/3%C2%BD/"]',
      "★★★★": 'a[href*="/rated/4/"]',
      "★★★★½": 'a[href*="/rated/4%C2%BD/"]',
      "★★★★★": 'a[href*="/rated/5/"]',
    }
  );
  let ai = 0;
  const { count, sum } = Object.entries(ratings).reduce(
    (m, [k, v]) => {
      ai += 0.5;
      m.count += v;
      m.sum += v * ai;
      return m;
    },
    { count: 0, sum: 0 }
  );
  const avgSelector = ".ratings-histogram-chart .average-rating";
  if (await page.$(avgSelector))
    await page.$eval(avgSelector, (e) => e.remove());
  await page.evaluate((avg) => {
    const avgSpan = document.createElement("span");
    avgSpan.className = "average-rating";
    const avgA = document.createElement("a");
    avgA.className = "display-rating";
    avgA.textContent = avg;
    avgSpan.appendChild(avgA);
    document.querySelector(".ratings-histogram-chart h2").after(avgSpan);
  }, round(sum / count, 1));
  const element = await page.$(".ratings-histogram-chart");
  await page.evaluate((element) => {
    element.style.backgroundColor = "#000";
  }, element);
  const chartBuffer = await element.screenshot();
  const chartInfo = await sharp(chartBuffer).metadata();

  await page.goto(
    `https://letterboxd.com/film/${letterboxd_slug}/reviews/by/activity/page/${letterboxd_page}`,
    { timeout: 60000, waitUntil: "networkidle2" }
  );
  await new Promise((r) => setTimeout(r, 5000));
  await page.evaluate(() => {
    document.querySelector(".sidebar").style.display = "none";
  });
  const elements = await page.$$(".film-detail-content");
  for (const element of elements) {
    const filePath = path.resolve(
      local,
      `letterboxd/${uniqueId(`${letterboxd_page}.`)}.png`
    );
    console.log(filePath);

    const review_url = await page.evaluate(
      (element) => element.querySelector("a.context").href,
      element
    );
    console.log(review_url);

    const [profile_url] = review_url.split("/film/");
    const profile_id = profile_url.split("/").pop();
    console.log(profile_url, profile_id);

    const [, profilePage] = await browser.pages();
    await profilePage.bringToFront();
    await profilePage.goto(profile_url, {
      timeout: 60000,
      waitUntil: "networkidle2",
    });

    console.log(
      await profilePage.evaluate(
        (e) => [...document.querySelectorAll(e)].map((i) => i.href),
        "a.metadatum"
      )
    );

    const total = await profilePage.evaluate(
      (e) =>
        +(document.querySelector(e)
          ? document.querySelector(e).innerText.replace(/[^0-9.]+/g, "")
          : ""),
      ".ratings-histogram-chart .all-link"
    );
    console.log(total);

    const ratings = await profilePage.evaluate(
      (selectors) => {
        const r = {};
        for (const [k, v] of Object.entries(selectors)) {
          const e = document.querySelector(v);
          if (e) {
            const [count] = e.innerText.match(/([0-9,.%]+)/g);
            r[k] = +count.replace(/[^0-9.]+/g, "");
          }
        }
        return r;
      },
      {
        "½": 'a[href*="/rated/%C2%BD/"]',
        "★": 'a[href*="/rated/1/"]',
        "★½": 'a[href*="/rated/1%C2%BD/"]',
        "★★": 'a[href*="/rated/2/"]',
        "★★½": 'a[href*="/rated/2%C2%BD/"]',
        "★★★": 'a[href*="/rated/3/"]',
        "★★★½": 'a[href*="/rated/3%C2%BD/"]',
        "★★★★": 'a[href*="/rated/4/"]',
        "★★★★½": 'a[href*="/rated/4%C2%BD/"]',
        "★★★★★": 'a[href*="/rated/5/"]',
      }
    );
    let ai = 0;
    const { count, sum } = Object.entries(ratings).reduce(
      (m, [k, v]) => {
        ai += 0.5;
        m.count += v;
        m.sum += v * ai;
        return m;
      },
      { count: 0, sum: 0 }
    );
    console.log(ratings, round(sum / count, 1));

    // switch focus
    await page.bringToFront();

    const rating = await page.evaluate(
      (element) =>
        element.querySelector(".rating")
          ? element.querySelector(".rating").innerText.trim()
          : "",
      element
    );
    if (ratings[rating])
      console.log(
        `${ratings[rating]}${getOrdinalSuffix(ratings[rating])}`,
        rating
      );

    await page.evaluate((element) => {
      element.style.backgroundColor = "#000";
    }, element);
    const reviewBuffer = await element.screenshot();
    const reviewInfo = await sharp(reviewBuffer).metadata();

    const padding = 48;
    const height =
      padding * 2 +
      chartInfo.height +
      padding * 2 +
      reviewInfo.height +
      padding * 2;
    const collageItemWidth = Math.ceil(height * 0.25);
    const width =
      collageItemWidth + padding * 2 + reviewInfo.width + padding * 2;
    await sharp({ create: { width, height, channels: 3, background: "#000" } })
      .composite([
        {
          input: await sharp(
            await (
              await fetch(image || sample(images), {
                ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
                headers: { "user-agent": "curl/1.0" },
              })
            ).buffer()
          )
            .resize(collageItemWidth, height)
            .toBuffer(),
          left: 0,
          top: 0,
        },
        {
          input: chartBuffer,
          left: collageItemWidth + padding * 2,
          top: padding * 2,
        },
        {
          input: reviewBuffer,
          left: collageItemWidth + padding * 2,
          top: padding * 2 + chartInfo.height + padding * 2,
        },
      ])
      .jpeg({ mozjpeg: true })
      .toFile(filePath);
  }

  // await browser.close();
})();
