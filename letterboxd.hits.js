const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { orderBy, startCase } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const { launch } = require("puppeteer");
const sharp = require("sharp");

const { executablePath, local, proxy } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { moment } = require("./config/moment.js");

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

(async () => {
  const collageMax = 10;
  const isMalayalam = (str = "") => /[\u0D00-\u0D7F]/.test(str);

  // filter
  const items = orderBy(
    configs
      .filter(
        (i) =>
          i.enable &&
          !moment().diff(i.releaseDate, "year") &&
          isMalayalam(i.originalName)
      )
      .map((i) => {
        i._count =
          (i.half || 0) +
          (i.one || 0) +
          (i.one_half || 0) +
          (i.two || 0) +
          (i.two_half || 0) +
          (i.three || 0) +
          (i.three_half || 0) +
          (i.four || 0) +
          (i.four_half || 0) +
          (i.five || 0);
        i.count = toEnIn(i._count, "en-in", { notation: "compact" });

        i._rating =
          i.average ||
          ((i.half || 0) * 0.5 +
            (i.one || 0) +
            (i.one_half || 0) * 1.5 +
            (i.two || 0) * 2 +
            (i.two_half || 0) * 2.5 +
            (i.three || 0) * 3 +
            (i.three_half || 0) * 3.5 +
            (i.four || 0) * 4 +
            (i.four_half || 0) * 4.5 +
            (i.five || 0) * 5) /
            i._count;
        i.rating = toEnIn(i._rating, "en-in", {
          notation: "compact",
        });

        return i;
      }),
    ["_rating", "_count"],
    ["desc", "desc"]
  ).slice(0, collageMax);

  console.log(
    `#Letterboxd top${collageMax} #Malayalam #Movies released within 1year period https://rebrand.ly/kbo-letterboxd\n\n${items
      .map(
        (i) => `#${startCase(i.ltrbxd_slug).replace(/\s+/g, "")} ~ ${i.rating}★`
      )
      .join("\n")}`
  );

  // other props
  for (const i of items.slice(0, 6 < collageMax ? 6 : collageMax)) {
    i.dominant = (
      await sharp(
        await (
          await fetch(i.image, {
            ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
            headers: { "user-agent": "curl/1.0" },
          })
        ).buffer()
      ).stats()
    ).dominant;
    i.bg =
      "#" +
      Object.values(i.dominant)
        .map((e) => e.toString(16).padStart(2, 0))
        .join("");
    i.fg =
      128 <
      Math.round(
        (i.dominant.r * 299 + i.dominant.g * 587 + i.dominant.b * 114) / 1000
      )
        ? "black"
        : "white";
  }

  // html generation
  const html_path = path.resolve(__dirname, "./letterboxd.hits.html");
  const html = fs.existsSync(html_path)
    ? fs.readFileSync(html_path, "utf8")
    : "";
  fs.writeFileSync(
    `${html_path}.html`,
    String.raw({ raw: html.split("$?") }, [
      JSON.stringify(items.slice(0, 6 < collageMax ? 6 : collageMax)),
    ])
  );

  // screenshot
  const browser = await launch({
    args: [
      "--disable-setuid-sandbox",
      "--lang=en-IN,en",
      "--no-sandbox",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
    executablePath,
    // headless: false,
  });
  let [page] = await browser.pages();
  if (!page) page = await browser.newPage();
  await page.goto(
    `file:///${path.resolve(__dirname, "./letterboxd.hits.html.html")}`,
    { waitUntil: "networkidle0" }
  );
  await (
    await page.$("#screenshot")
  ).screenshot({
    path: path.resolve(local, "letterboxd.hits.png"),
  });
  await browser.close();

  // table generation
  let rank = 1;
  let text = `Letterboxd top${collageMax} Malayalam Movies released within 1year period | last updated at ${moment().format(
    "YYYY-MM-DDTHH:mmZ"
  )}\n\n| Rank | Movie | Reviews | Weighted Average↓ | Director | Genre | Released At |\n| -: | :- | -: | -: | :- | :- | :- |`;
  for (const i of items)
    text += `\n| ${rank++} | [${startCase(i.name).replace(
      /([A-Z]) (\d) ([A-Z])/g,
      "$1$2 $3"
    )}](https://letterboxd.com/film/${i.ltrbxd_slug})${
      i.originalName ? ` ~ ${i.originalName}` : ""
    } | ${i.count} | ${i.rating} | ${Object.entries(i.director || {})
      .map(([k, v]) => `[${v}](https://letterboxd.com${k})`)
      .sort()
      .join(" / ")} | ${(i.genre || []).sort().join(" / ")} | ${
      i.releaseDate
    } |`;
  console.log(text);
})();
