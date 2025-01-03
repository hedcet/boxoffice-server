const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { orderBy } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");

const { local, proxy } = require("./config/env.js");

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

(async () => {
  const fixtures = orderBy(
    configs.filter((i) => i.enable),
    ["releaseDate"],
    ["desc"]
  );

  fs.writeFileSync(
    path.resolve(local, "src/fixture.tsx"),
    `export const ltrbxd = ${JSON.stringify(fixtures)}`
  );

  let index = 0;
  for (const fixture of fixtures) {
    console.log(index++, fixture);
    const filePath = path.resolve(
      local,
      `assets/ltrbxd/${fixture.ltrbxd_slug}.jpg`
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
