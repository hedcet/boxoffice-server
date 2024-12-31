const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { orderBy } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");

const { local, proxy } = require("./config/env.js");
const { moment } = require("./config/moment.js");

const config_path = path.resolve(__dirname, "./letterboxd.ml.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

(async () => {
  const fixtures = orderBy(
    configs.filter(
      (i) =>
        i.enable &&
        i.releaseDate &&
        moment(i.releaseDate).isBefore() &&
        0 <
          (i.half || 0) +
            (i.one || 0) +
            (i.one_half || 0) +
            (i.two || 0) +
            (i.two_half || 0) +
            (i.three || 0) +
            (i.three_half || 0) +
            (i.four || 0) +
            (i.four_half || 0) +
            (i.five || 0) &&
        i.image
    ),
    ["releaseDate"],
    ["desc"]
  ).slice(0, 30); // top100

  fs.writeFileSync(
    path.resolve(local, "ml-movies.fixtures.json"),
    JSON.stringify(fixtures, undefined, 2)
  );

  let index = 0;
  for (const fixture of fixtures) {
    console.log(index++, fixture);
    const filePath = path.resolve(
      local,
      `ltrbxd/${fixture.letterboxd_slug}.jpg`
    );
    if (!fs.existsSync(filePath)) {
      const r = await fetch(fixture.image, {
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
        headers: { "user-agent": "curl/1.0" },
      });
      const fileStream = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        fileStream.on("finish", resolve);
        r.body.on("error", reject);
        r.body.pipe(fileStream);
      });
    }
  }
})();
