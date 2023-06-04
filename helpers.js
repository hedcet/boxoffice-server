// v14 <= node
// npm install fast-csv
// node helpers.js

const { parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
const path = require("path");

const cache = {};
const movieNameRegExp = /^Neymar\./;
const storePath = "store/dump";

(async () => {
  const dump = path.resolve(storePath);
  for (const i of fs.readdirSync(dump)) {
    const file = path.resolve(dump, i);
    if (
      fs.lstatSync(file).isFile() &&
      path.basename(file).match(movieNameRegExp)
    ) {
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
              const key = `${j.State}|${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`;
              const sum = +j.Booked * +j.Price.replace(/[^0-9]+/g, "");

              if (!cache.booked) cache.booked = 0;
              if (!cache.capacity) cache.capacity = 0;
              if (!cache.shows) cache.shows = 0;
              if (!cache.sum) cache.sum = 0;

              cache.booked += booked;
              cache.capacity += capacity;
              if (cache.key !== key) cache.shows += 1;
              cache.key = key;
              cache.sum += sum;
            }
            cache.occupancy = (cache.booked / cache.capacity) * 100;
            resolve(true);
          });
      });
    }
  }
  cache.key = movieNameRegExp;
  console.log(cache);
})();
