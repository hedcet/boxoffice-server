// v14 <= node
// npm install fast-csv moment moment-timezone nedb-promises
// node helper.js

const { parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { db } = require("./db.js");

const cache = {};
const dumpDir = "store/dump";
const query = { name: "Neymar" };

(async () => {
  for (const { date, key, name, source } of await db
    .find(query)
    .sort({ date: 1 })) {
    const file = path.resolve(
      dumpDir,
      `${source}/${name}/${key}.${moment(date).format("YYYY-MM-DD")}.csv`
    );
    if (fs.existsSync(file)) {
      console.log(file);
      await new Promise(async (resolve, reject) => {
        const data = [];
        parseString(fs.readFileSync(file, "utf8"), { headers: true })
          .on("error", reject)
          .on("data", (row) => data.push(row))
          .on("end", () => {
            for (const j of data) {
              const booked = +j.Booked;
              const capacity = +j.Capacity;
              const query = `${j.State}|${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`;
              const sum = +j.Booked * +j.Price.replace(/[^0-9]+/g, "");
              if (!cache.booked) cache.booked = 0;
              if (!cache.capacity) cache.capacity = 0;
              if (!cache.shows) cache.shows = 0;
              if (!cache.sum) cache.sum = 0;
              cache.booked += booked;
              cache.capacity += capacity;
              if (cache.query !== query) cache.shows += 1;
              cache.query = query;
              cache.sum += sum;
            }
            cache.occupancy = (cache.booked / cache.capacity) * 100;
            resolve(true);
          });
      });
    }
  }
  cache.query = query;
  console.log(cache);
})();
