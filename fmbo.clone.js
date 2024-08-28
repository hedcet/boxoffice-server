const cheerio = require("cheerio");
const fs = require("fs");
const fetch = require("node-fetch");
const { camelCase, upperFirst } = require("lodash");
const path = require("path");

const { toEnIn } = require("./config/misc.js");
const { moment } = require("./config/moment.js");
const { client } = require("./config/snoowrap.js");

function toUpperFirstCamelCase(text) {
  return upperFirst(camelCase(text));
}

(async () => {
  const config_path = path.resolve(__dirname, "./fmbo.json");
  const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

  // // brute force
  // for (let i = 1; i < 600; i++) {
  //   console.log(`https://fridaymatinee.in/fmbo/boxoffice?movieid=${i}`);
  //   const $ = cheerio.load(
  //     await fetch(`https://fridaymatinee.in/fmbo/boxoffice?movieid=${i}`).then(
  //       (r) => r.text()
  //     )
  //   );
  //   const title = toUpperFirstCamelCase($(".movie-title").text());
  //   if (!title) continue;
  //   const image = `https://fridaymatinee.in/fmbo/${$(".header-bg img").attr(
  //     "src"
  //   )}`;
  //   const data = [];
  //   $("#fmbo1 tr").each((i, e) => {
  //     if ($(e).find("td").length && 6 <= $(e).find("td,th").length) {
  //       const [day, d = ""] = $(e)
  //         .find("td:nth-child(1) b")
  //         .remove("i")
  //         .text()
  //         .trim()
  //         .split("-");
  //       const date = moment(d.trim(), ["Do MMM DDD"]);
  //       if ($(e).find("th").length)
  //         data.push({
  //           name: "",
  //           shows: +$(e)
  //             .find("td:nth-child(2) > b")
  //             .text()
  //             .replace(/[^0-9]+/g, ""),
  //           booked: +$(e)
  //             .find("th:nth-child(3) > font")
  //             .text()
  //             .replace(/[^0-9]+/g, ""),
  //           occupancy: `${$(e)
  //             .find("th:nth-child(4) > font")
  //             .text()
  //             .replace(/[^0-9.%]+/g, "")}%`,
  //           sum: +$(e)
  //             .find("td:nth-child(6) > span")
  //             .attr("title")
  //             .replace(/[^0-9]+/g, ""),
  //         });
  //       else
  //         data.push({
  //           name: `${date.format("MMMDddd")} ${day.trim()}`,
  //           shows: +$(e)
  //             .find("td:nth-child(2) > b")
  //             .text()
  //             .replace(/[^0-9]+/g, ""),
  //           booked: +$(e)
  //             .find("td:nth-child(3) > b")
  //             .text()
  //             .replace(/[^0-9]+/g, ""),
  //           occupancy: $(e)
  //             .find("td:nth-child(4)")
  //             .text()
  //             .replace(/[^0-9.%]+/g, ""),
  //           sum: +$(e)
  //             .find("td:nth-child(6) > b")
  //             .text()
  //             .replace(/[^0-9]+/g, ""),
  //         });
  //     }
  //   });
  //   configs[i] = { title, image, data };
  //   fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
  //   console.log(title, image, data[data.length - 1]);
  // }

  // reddit
  for (const v of Object.values(configs))
    if (!v.reddit) {
      // text-generation
      if (!v.data.length) continue;
      let text = `kerala boxoffice tracked data\n\n| Date | Shows | Occupancy | Gross |\n| - | -: | -: | -: |`;
      for (const { name, shows, booked, sum, occupancy } of v.data)
        text += `\n| ${name} | ${toEnIn(shows)} | ${toEnIn(booked)}${
          booked ? `(${occupancy})` : ""
        } | ₹${
          sum < 1000
            ? toEnIn(sum)
            : toEnIn(sum, "en-in", { notation: "compact" })
        } |`;
      text += `\n\n[source](https://github.com/hedcet/boxoffice-server/blob/main/fmbo.json) | last updated at ${moment().format(
        "YYYY-MM-DDTHH:mmZ"
      )}`;
      await new Promise((resolve, reject) =>
        client
          .getSubreddit("friday_matinee")
          .submitLink({ title: v.title, url: v.image })
          // .approve()
          .reply(text)
          // .approve()
          .then(resolve)
          .catch(reject)
      );
      v.reddit = true;
      fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
      console.log(v, text);
      await new Promise((r) => setTimeout(r, 60000));
    }
})();
