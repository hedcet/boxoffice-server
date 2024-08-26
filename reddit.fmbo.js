const cheerio = require("cheerio");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const { toEnIn } = require("./config/misc.js");
const { moment } = require("./config/moment.js");
const { client } = require("./config/snoowrap.js");

(async () => {
  // mapping reddit post to fmbo url_id
  // store comment id to overwrite
  const config_path = path.resolve(__dirname, "./reddit.json");
  const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));
  for (const config of configs) {
    if (!config.enable) continue; // for long run
    if (!["fmbo"].includes(config.source)) continue;

    // scraping
    const $ = cheerio.load(
      await fetch(
        `https://fridaymatinee.in/fmbo/boxoffice?movieid=${config.url_id}`
      ).then((r) => r.text())
    );
    const data = [];
    $("#fmbo1 tr").each((i, e) => {
      if ($(e).find("td").length && 6 <= $(e).find("td,th").length) {
        const [day, d = ""] = $(e)
          .find("td:nth-child(1) b")
          .remove("i")
          .text()
          .trim()
          .split("-");
        const date = moment(d.trim(), ["Do MMM DDD"]);
        if ($(e).find("th").length)
          data.push({
            name: "",
            shows: +$(e)
              .find("td:nth-child(2) > b")
              .text()
              .replace(/[^0-9]+/g, ""),
            booked: +$(e)
              .find("th:nth-child(3) > font")
              .text()
              .replace(/[^0-9]+/g, ""),
            occupancy: `${$(e)
              .find("th:nth-child(4) > font")
              .text()
              .replace(/[^0-9.%]+/g, "")}%`,
            sum: +$(e)
              .find("td:nth-child(6) > span")
              .attr("title")
              .replace(/[^0-9]+/g, ""),
          });
        else
          data.push({
            name: `${date.format("MMMDddd")} ${day.trim()}`,
            shows: +$(e)
              .find("td:nth-child(2) > b")
              .text()
              .replace(/[^0-9]+/g, ""),
            booked: +$(e)
              .find("td:nth-child(3) > b")
              .text()
              .replace(/[^0-9]+/g, ""),
            occupancy: $(e)
              .find("td:nth-child(4)")
              .text()
              .replace(/[^0-9.%]+/g, ""),
            sum: +$(e)
              .find("td:nth-child(6) > b")
              .text()
              .replace(/[^0-9]+/g, ""),
          });
      }
    });

    // text-generation
    if (!data.length) continue;
    let text = `kerala boxoffice tracked data\n\n| Date | Shows | Occupancy | Gross |\n| - | -: | -: | -: |`;
    for (const { name, shows, booked, sum, occupancy } of data)
      text += `\n| ${name} | ${toEnIn(shows)} | ${toEnIn(booked)}${
        booked ? `(${occupancy})` : ""
      } | ₹${
        sum < 1000 ? toEnIn(sum) : toEnIn(sum, "en-in", { notation: "compact" })
      } |`;
    text += `\n\n[source](https://fridaymatinee.in/fmbo/boxoffice?movieid=${
      config.url_id
    }) | last updated at ${moment().format("YYYY-MM-DDTHH:mmZ")}`;
    console.log(config, text);

    // reddit
    if (config.comment_id)
      await new Promise((resolve, reject) =>
        client
          .getComment(config.comment_id)
          .edit(text)
          .then(resolve)
          .catch(reject)
      );
    else if (config.reply_to) {
      const { id } = await new Promise((resolve, reject) =>
        client
          .getSubmission(config.reply_to)
          .reply(text)
          .then(resolve)
          .catch(reject)
      );
      config.comment_id = id;
      fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
    } else throw Error("invalid config");

    await new Promise((r) => setTimeout(r, 60000));
  }
})();
