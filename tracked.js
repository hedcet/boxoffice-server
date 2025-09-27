const { parseString } = require("fast-csv");
const fs = require("fs");
const { groupBy, orderBy, round, startCase } = require("lodash");
const path = require("path");

const { csvPath } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");
const { client } = require("./config/snoowrap.js");

(async () => {
  const reddit_post_id = "1gsfg0b";

  const start_date = moment("2024-08-17", ["YYYY-MM-DD"]).startOf("day");
  const end_date = moment().startOf("day");

  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  for (const { group } of await db.find({
    date: { $gte: start_date.toDate(), $lt: end_date.toDate() },
    group: { $exists: true },
  })) {
    const $in = await db.find({ group });
    await db.update(
      { id: { $in: $in.map((i) => i.id) } },
      { $set: { group } },
      { multi: true }
    );
  }

  // aggregate
  const data = {};
  for (const i of await db
    .find({ date: { $gte: start_date.toDate(), $lt: end_date.toDate() } })
    .sort({ date: 1 })) {
    const date = moment(i.date).format("YYYY-MM-DD");
    const file = path.resolve(csvPath, `${i.name}/${i.id}.${date}.csv`);
    console.log(file);
    const _id = i.group || i.id;
    if (!data[_id])
      data[_id] = {
        _id,
        name: i.name,
        from: date,
        shows: 0,
        booked: 0,
        capacity: 0,
        sum: 0,
      };
    data[_id].to = date;
    data[_id].files = (data[_id].files || 0) + 1;
    await new Promise(async (resolve, reject) => {
      const csv = [];
      parseString(fs.readFileSync(file, "utf8"), { headers: true })
        .on("error", reject)
        .on("data", (row) => csv.push(row))
        .on("end", () => {
          for (const j of csv) {
            const show_id = `${j.City}|${j["Time(IST)"]}|${j.Name}|${j.Language}|${i.Format}`; // unique show id
            const booked = +j.Booked.replace(/[^0-9]+/g, "");
            const capacity = +j.Capacity.replace(/[^0-9]+/g, "");
            const sum = booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");
            if (capacity) {
              if (data[_id].show_id != show_id) {
                data[_id].show_id = show_id;
                data[_id].shows += 1;
              }
              data[_id].booked += booked;
              data[_id].capacity += capacity;
              data[_id].sum += sum;
            }
          }
          resolve(true);
        });
    });
  }

  const items = orderBy(
    Object.values(data),
    ["from", "booked"],
    ["desc", "desc"]
  );

  // dedup
  const names = groupBy(items, "name");
  for (const [k, v] of Object.entries(names))
    if (1 < v.length)
      console.log(
        k,
        v.length,
        v.map((i) => i.from)
      );

  // table generation
  let text =
    "| Movie | Shows | Occupancy | Gross | From | To | Files |\n| - | -: | -: | -: | - | - | -: |";
  for (const item of items) {
    const t = `\n| [${startCase(item.name).replace(
      /([A-Z]) (\d) ([A-Z])/g,
      "$1$2 $3"
    )}](https://github.com/hedcet/boxoffice/tree/main/${item.name})${
      1 < names[item.name].length ? ` (${item._id}.*)` : ""
    } | ${toEnIn(item.shows)} | ${toEnIn(item.booked, "en-in", {
      notation: "compact",
    })}${
      item.booked ? `(${round((item.booked / item.capacity) * 100, 2)}%)` : ""
    } | ₹${toEnIn(item.sum, "en-in", {
      notation: "compact",
    })} | ${item.from} | ${item.to} | ${item.files} |`;
    if (40000 < `${text}${t}`.length) break;
    text += t;
  }

  // reddit
  try {
    await new Promise((resolve, reject) =>
      client
        .getSubmission(reddit_post_id)
        .edit(text)
        .then(resolve)
        .catch(reject)
    );
  } catch (e) {
    console.error(e);
  }
})();
