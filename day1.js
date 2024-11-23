const { parseString } = require("fast-csv");
const fs = require("fs");
const { groupBy, orderBy, round, uniq } = require("lodash");
const path = require("path");

const { csvPath } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");
const { client } = require("./config/snoowrap.js");

const json_path = path.resolve(__dirname, "./store/data.json");
const json = fs.existsSync(json_path)
  ? JSON.parse(fs.readFileSync(json_path, "utf8"))
  : {};

(async () => {
  const reddit_post_id = "1gwyydp";

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
    if (!data[_id]) data[_id] = {};
    data[_id][date] = { _id, date, id: i.id, name: i.name, shows: 0, booked: 0, capacity: 0, sum: 0, };
    await new Promise(async (resolve, reject) => {
      const csv = [];
      parseString(fs.readFileSync(file, "utf8"), { headers: true })
        .on("error", reject)
        .on("data", (row) => csv.push(row))
        .on("end", () => {
          for (const j of csv) {
            const show_id = `${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`; // unique show id
            const booked = +j.Booked.replace(/[^0-9]+/g, "");
            const capacity = +j.Capacity.replace(/[^0-9]+/g, "");
            const sum = booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");
            if (capacity) {
              if (data[_id][date].show_id != show_id) {
                data[_id][date].show_id = show_id;
                data[_id][date].shows += 1;
              }
              data[_id][date].booked += booked;
              data[_id][date].capacity += capacity;
              data[_id][date].sum += sum;
            }
          }
          resolve(true);
        });
    });
  }

  // re-aggregate
  const _items = []
  for (const d of Object.values(data)) {
    const v = Object.values(d)
    let _item = v[0].shows < v[1]?.shows * .25 ? v[1] : v[0];
    for (const i of v)
      if (d[json[i.id]?.released_at]) {
        _item = d[json[i.id]?.released_at]
        break;
      }
    if (1000000 < _item.sum)
      _items.push(_item)
  }

  const items = orderBy(
    Object.values(_items),
    ["date", "booked"],
    ["desc", "desc"]
  );

  // dedup
  const names = groupBy(items, "name");
  for (const [k, v] of Object.entries(names))
    if (1 < v.length)
      console.log(
        k,
        v.length,
        v.map((i) => i.date)
      );

  // table generation
  let text =
    "| Day1 | Movie | Shows | Occupancy | Gross |\n| - | - | -: | -: | -: |";
  for (const item of items)
    text += `\n| ${item.date} | [#${item.name
      }](https://github.com/hedcet/boxoffice/tree/main/${item.name})${1 < names[item.name].length ? ` (${item._id}.*)` : ""
      } | ${toEnIn(item.shows)} | ${toEnIn(item.booked, "en-in", {
        notation: "compact",
      })}${item.booked ? `(${round((item.booked / item.capacity) * 100, 2)}%)` : ""
      } | ₹${toEnIn(item.sum, "en-in", {
        notation: "compact",
      })} |`;

  // reddit
  await new Promise((resolve, reject) =>
    client.getSubmission(reddit_post_id).edit(text).then(resolve).catch(reject)
  );
})();
