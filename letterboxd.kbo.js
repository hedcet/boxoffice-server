const cheerio = require("cheerio");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { orderBy, startCase } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const { isJSON } = require("validator");

const { proxy } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { moment } = require("./config/moment.js");
const { client } = require("./config/snoowrap.js");

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

(async () => {
  const reddit_post_id = "1h8r7s5";

  // letterboxd fetch
  for (const config of orderBy(
    configs.filter((i) => i.enable && moment().diff(i.last_updated_at, "day")),
    [(i) => i.last_updated_at || ""], // last updated first
    ["asc"]
  )) {
    console.log(config);

    const $1 = cheerio.load(
      await fetch(`https://letterboxd.com/film/${config.letterboxd_slug}`, {
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
        headers: { "user-agent": "curl/1.0" },
      }).then((r) => r.text())
    );

    const metadata = $1('script:contains("<![CDATA[")')
      .text()
      .match(/\/\*.*<\!\[CDATA\[.*\*\/([\s+\S+]*)\/\*.*\]\]>.*\*\//);
    if (metadata && isJSON(metadata[1])) {
      const { director = [], genre = [], image } = JSON.parse(metadata[1]);

      // director
      for (const { name, sameAs } of director) {
        if (!config.director) config.director = {};
        config.director[sameAs] = name;
      }
      if (genre.length) config.genre = genre; // genre
      if (image) config.image = image; // image

      config.last_updated_at = moment().format("YYYY-MM-DDTHH:mmZ");
      fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
    }

    // releaseDate
    const releaseDate = $1('.-bycountry > .listitem:contains("India")')
      .find('.release-date-list:contains("Theatrical")')
      .find(".date")
      .text();
    if (releaseDate && moment(releaseDate, ["DD MMM YYYY"]).isValid()) {
      config.releaseDate = moment(releaseDate, ["DD MMM YYYY"]).format(
        "YYYY-MM-DD"
      );

      config.last_updated_at = moment().format("YYYY-MM-DDTHH:mmZ");
      fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
    }

    // ratings
    const $10 = cheerio.load(
      await fetch(
        `https://letterboxd.com/csi/film/${config.letterboxd_slug}/rating-histogram`,
        {
          ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
          headers: { "user-agent": "curl/1.0" },
        }
      ).then((r) => r.text())
    );

    if (!$10(".ratings-histogram-chart").length) continue;

    const average_selector = ".average-rating a";
    if ($10(average_selector).length) {
      const [average, total] = $10(average_selector)
        .attr("title")
        .match(/([0-9,.%]+)/g);
      config.average = +average;
      config.total = +total.replace(/[^0-9.]+/g, "");
    }

    const selectors = {
      half: 'a[href*="/rated/%C2%BD/"]',
      one: 'a[href*="/rated/1/"]',
      one_half: 'a[href*="/rated/1%C2%BD/"]',
      two: 'a[href*="/rated/2/"]',
      two_half: 'a[href*="/rated/2%C2%BD/"]',
      three: 'a[href*="/rated/3/"]',
      three_half: 'a[href*="/rated/3%C2%BD/"]',
      four: 'a[href*="/rated/4/"]',
      four_half: 'a[href*="/rated/4%C2%BD/"]',
      five: 'a[href*="/rated/5/"]',
    };
    for (const [k, v] of Object.entries(selectors))
      if ($10(v).length) {
        const [count] = $10(v)
          .attr("title")
          .match(/([0-9,.%]+)/g);
        config[k] = +count.replace(/[^0-9.]+/g, "");
      }

    config.last_updated_at = moment().format("YYYY-MM-DDTHH:mmZ");
    fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
  }

  // table generation
  let rank = 1;
  let text = `| Rank | Movie | Reviews | Average | Director | Genre | Last Updated At |\n| -: | :- | -: | -: | :- | :- | :- |`;
  for (const config of orderBy(
    configs.filter((i) => i.enable),
    [
      (i) => i.average || 0,
      (i) =>
        (i.half || 0) +
        (i.one || 0) +
        (i.one_half || 0) +
        (i.two || 0) +
        (i.two_half || 0) +
        (i.three || 0) +
        (i.three_half || 0) +
        (i.four || 0) +
        (i.four_half || 0) +
        (i.five || 0),
    ],
    ["desc", "desc"]
  )) {
    const total =
      config.total ||
      (config.half || 0) +
        (config.one || 0) +
        (config.one_half || 0) +
        (config.two || 0) +
        (config.two_half || 0) +
        (config.three || 0) +
        (config.three_half || 0) +
        (config.four || 0) +
        (config.four_half || 0) +
        (config.five || 0);
    text += `\n| ${rank++} | [${startCase(
      config.github_folder
    )}](https://letterboxd.com/film/${config.letterboxd_slug}) | ${
      total ? toEnIn(total) : ""
    } | ${config.average ? config.average : ""} | ${Object.entries(
      config.director || {}
    )
      .map(([k, v]) => `[${v}](https://letterboxd.com${k})`)
      .sort()
      .join(" / ")} | ${(config.genre || []).sort().join(" / ")} | ${
      config.last_updated_at.split("T")[0]
    } |`;
  }
  console.log(text);

  // reddit
  await new Promise((resolve, reject) =>
    client.getSubmission(reddit_post_id).edit(text).then(resolve).catch(reject)
  );
})();
