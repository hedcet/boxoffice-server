const { parseString } = require("fast-csv");
const fs = require("fs");
const path = require("path");

const { db } = require("./db.js");
const { dumpDir } = require("./env.js");
const { moment } = require("./moment.js");

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
    if (!fs.existsSync(file)) {
      console.error("file not found", file);
      continue;
    }
    await new Promise(async (resolve, reject) => {
      console.log(file);

      // setup aggregation store
      const _id = type === "date" ? name : moment(date).format("YYYYMMMDddd");
      if (!data[_id])
        data[_id] = {
          _id,
          date,
          shows: 0,
          booked: 0,
          capacity: 0,
          sum: 0,
          // hf: [0], // hf[0] store house full count
        };
      const ref = data[_id];

      // read csv & aggregate
      const csv = [];
      parseString(fs.readFileSync(file, "utf8"), { headers: true })
        .on("error", reject)
        .on("data", (row) => csv.push(row))
        .on("end", () => {
          for (const j of csv) {
            const _show_id = `${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`; // unique show id
            const booked = +j.Booked.replace(/[^0-9]+/g, "");
            const capacity = +j.Capacity.replace(/[^0-9]+/g, "");
            const sum = booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");

            ref.booked += booked;
            ref.capacity += capacity;
            // ref.hf.push(0.99 < booked / capacity);
            if (_show_id !== ref._show_id) {
              ref.shows += 1;
              // if (ref.hf.slice(1).every((i) => i)) ref.hf[0] += 1;
              // ref.hf.splice(1);
              ref._show_id = _show_id;
            }
            ref.sum += sum;
          }
          ref.occupancy = ref.capacity ? ref.booked / ref.capacity : 0;
          resolve(true);
        });
    });
  }

  return data;
};

module.exports = { syncMetadata, aggregate };
