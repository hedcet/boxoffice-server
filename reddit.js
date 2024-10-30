const { parseString } = require("fast-csv");
const fs = require("fs");
const { round } = require("lodash");
const path = require("path");

const { csvPath } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");
const { client } = require("./config/snoowrap.js");
const { group } = require("console");

(async () => {
  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  // mapping reddit post to github folder
  // store comment id to overwrite
  const config_path = path.resolve(__dirname, "./reddit.json");
  const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));
  for (const config of configs) {
    if (!config.enable) continue; // for long run
    if (!["github"].includes(config.source)) continue;

    // TODO - validate
    const start_date = moment(config.start_date, ["YYYY-MM-DD"]);
    const end_date = config.end_date
      ? moment(config.end_date, ["YYYY-MM-DD"])
      : moment();

    if (config.github_group) {
      const $in = await db.find({ group: { $in: config.github_group } });
      await db.update(
        { id: { $in: $in.map((i) => i.id) } },
        { $set: { group: config.github_group } },
        { multi: true }
      );
    }

    // aggregate
    const data = {};
    for (const i of await db
      .find({
        date: { $gte: start_date.toDate(), $lte: end_date.toDate() },
        ...(config.github_group
          ? { group: { $in: config.github_group } }
          : { name: config.github_folder }),
      })
      .sort({ date: 1 })) {
      if (!config.github_folder) {
        config.github_folder = i.name;
        fs.writeFileSync(config_path, JSON.stringify(configs, undefined, 2));
      }
      const date = moment(i.date);
      const _date_id = date.format("YYYY-MM-DD");
      if (!data[_date_id])
        data[_date_id] = {
          name: `${date.format("MMMDddd")}${
            0 <= date.diff(start_date, "day")
              ? ` D${date.diff(start_date, "day") + 1}`
              : ""
          }`,
          shows: {},
        };
      const file = path.resolve(csvPath, `${i.name}/${i.id}.${_date_id}.csv`);
      console.log(file);
      await new Promise(async (resolve, reject) => {
        const csv = [];
        parseString(fs.readFileSync(file, "utf8"), { headers: true })
          .on("error", reject)
          .on("data", (row) => csv.push(row))
          .on("end", () => {
            for (const j of csv) {
              const _show_id = `${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`; // unique show id
              const booked = +j.Booked.replace(/[^0-9]+/g, "");
              const capacity = +j.Capacity.replace(/[^0-9]+/g, "");
              const sum =
                booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");
              if (capacity) {
                if (!data[_date_id]["shows"][_show_id])
                  data[_date_id]["shows"][_show_id] = {
                    capacity: 0,
                    booked: 0,
                    sum: 0,
                  };
                data[_date_id]["shows"][_show_id]["capacity"] += capacity;
                data[_date_id]["shows"][_show_id]["booked"] += booked;
                data[_date_id]["shows"][_show_id]["sum"] += sum;
              }
            }
            resolve(true);
          });
      });
    }

    // text-generation
    if (!Object.values(data).length) continue;
    let text = `kerala boxoffice tracked data\n\n| Date | Shows | Occupancy | Gross |\n| - | -: | -: | -: |`;
    const total = { shows: 0, capacity: 0, booked: 0, sum: 0 };
    for (const { name, shows } of Object.values(data)) {
      const { capacity, booked, sum } = Object.values(shows).reduce(
        (m, i) => {
          m.capacity += i.capacity;
          m.booked += i.booked;
          m.sum += i.sum;
          return m;
        },
        { capacity: 0, booked: 0, sum: 0 }
      );
      text += `\n| ${name} | ${toEnIn(Object.values(shows).length)} | ${toEnIn(
        booked
      )}${booked ? `(${round((booked / capacity) * 100, 2)}%)` : ""} | ₹${
        sum < 1000 ? toEnIn(sum) : toEnIn(sum, "en-in", { notation: "compact" })
      } |`;
      total.shows += Object.values(shows).length;
      total.capacity += capacity;
      total.booked += booked;
      total.sum += sum;
    }
    text += `\n| | ${toEnIn(total.shows)} | ${toEnIn(total.booked)}${
      total.booked
        ? `(${round((total.booked / total.capacity) * 100, 2)}%)`
        : ""
    } | ₹${
      total.sum < 1000
        ? toEnIn(total.sum)
        : toEnIn(total.sum, "en-in", { notation: "compact" })
    } |\n\n[source](https://github.com/hedcet/boxoffice/tree/main/${
      config.github_folder
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

    await new Promise((r) => setTimeout(r, 1000 * 3));
  }
})();
