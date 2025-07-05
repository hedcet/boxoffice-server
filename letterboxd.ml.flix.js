const fs = require("fs");
const { startCase } = require("lodash");
const path = require("path");

const { moment } = require("./config/moment.js");
const { client } = require("./config/snoowrap.js");

const config_path = path.resolve(__dirname, "./letterboxd.ml.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8")).filter(
  (i) => i.enable && i.releaseDate && moment(i.releaseDate).isAfter()
);

(async () => {
  const reddit_post_id = "1i20abo";

  let rows;
  await new Promise((resolve, reject) =>
    client
      .getSubmission(reddit_post_id)
      .selftext.then((text) => {
        rows = text
          .split("\n")
          .map((r) =>
            r
              .trim()
              .split("|")
              .filter(Boolean)
              .map((c) => c.trim())
          )
          .slice(2);
      })
      .then(resolve)
      .catch(reject)
  );
  for (const config of configs.filter(
    (i) => !rows.find((r) => r[0].includes(`film/${i.ltrbxd_slug}`))
  ))
    rows.push([
      `[${startCase(config.name).replace(
        /([A-Z]) (\d) ([A-Z])/g,
        "$1$2 $3"
      )}](https://letterboxd.com/film/${config.ltrbxd_slug})${
        config.originalName ? ` ~ ${config.originalName}` : ""
      }`,
      `${Object.entries(config.director || {})
        .map(([k, v]) => `[${v}](https://letterboxd.com${k})`)
        .sort()
        .join(" / ")}`,
      config.releaseDate,
    ]);
  rows.sort((a, b) => (moment(a[2]).isAfter(b[2]) ? 1 : -1));

  [
    ...configs.map((i) => `${i.ltrbxd_slug}|ltrbxd`),
    ...rows.map(
      (i) =>
        `${i[0]
          .match(/\((.*)\)/)[1]
          .split("/")
          .pop()}|r`
    ),
  ]
    .sort()
    .map((v, i) => console.log(i + 1, v));

  console.log(
    `| Movie | Director | Tentative Release Date |\n| :- | :- | :- |\n${rows
      .map((r) => `| ${r.join(" | ")} |`)
      .join("\n")}`
  );
})();
