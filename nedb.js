const { parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { db } = require("./db.js");
const { dumpDir } = require("./env.js");

const syncMetadata = async (relativeDir) => {
  const dir = path.resolve(dumpDir, relativeDir);
  for (const folderName of fs.readdirSync(dir))
    if (folderName.match(/^[0-9a-z]/i)) {
      const folder = path.resolve(dir, folderName);
      if (fs.lstatSync(folder).isDirectory())
        for (const fileName of fs.readdirSync(folder)) {
          if (fileName.match(/^[0-9a-z]/i)) {
            const file = path.resolve(folder, fileName);
            if (fs.lstatSync(file).isFile()) {
              const [key, d, ext = ""] = fileName.split(".");
              if (ext.match(/csv/i)) {
                const item = {
                  date: moment.tz(d, ["YYYY-MM-DD"], "Asia/Kolkata").toDate(),
                  key,
                  name: folderName,
                  source: relativeDir,
                };
                if (!(await db.findOne(item)))
                  console.log(file, await db.insert(item));
              }
            }
          }
        }
    }
};

const aggregate = async (query = {}, type = "date") => {
  const data = {};

  for (const { date, key, name, source } of await db
    .find(query)
    .sort({ date: 1 })) {
    const file = path.resolve(
      dumpDir,
      `${source}/${name}/${key}.${moment(date).format("YYYY-MM-DD")}.csv`
    );
    if (fs.existsSync(file))
      await new Promise(async (resolve, reject) => {
        console.log(file);

        // aggregation store
        const _id = type === "date" ? name : moment(date).format("MMMDddd");
        if (!data[_id]) data[_id] = { _id };
        const ref = data[_id];

        const csv = [];
        parseString(fs.readFileSync(file, "utf8"), { headers: true })
          .on("error", reject)
          .on("data", (row) => csv.push(row))
          .on("end", () => {
            for (const j of csv) {
              const _change = `${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`;
              const booked = +j.Booked;
              const capacity = +j.Capacity;
              const sum = +j.Booked * +j.Price.replace(/[^0-9]+/g, "");

              if (!ref.booked) ref.booked = 0;
              if (!ref.capacity) ref.capacity = 0;
              // if (!ref.hf) ref.hf = [0];
              if (!ref.shows) ref.shows = 0;
              if (!ref.sum) ref.sum = 0;

              ref.booked += booked;
              ref.capacity += capacity;
              // ref.hf.push(0.99 < booked / capacity);
              if (_change !== ref._change) {
                ref.shows += 1;
                // if (ref.hf.slice(1).every((i) => i)) ref.hf[0] += 1;
                // ref.hf.splice(1);
                ref._change = _change;
              }
              ref.sum += sum;
            }
            ref.occupancy = ref.booked / ref.capacity;
            resolve(true);
          });
      });
  }

  return data;
};

module.exports = { syncMetadata, aggregate };
