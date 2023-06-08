const { createCanvas } = require("canvas");
const { CanvasTable } = require("canvas-table");
const { parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
const { orderBy } = require("lodash");
const moment = require("moment");
numeral = require("numeral");
const path = require("path");
const sharp = require("sharp");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { db } = require("./db.js");
const { toLocaleNumber } = require("./functions.js");
const { worker } = require("./worker.js");

(async () => {
  let cmd_source = process.argv[2] || "bms";
  let cmd_type = process.argv[3] || "date";
  let cmd_type_data =
    process.argv[4] || moment().subtract(1, "day").format("YYYY-MM-DD");

  let query = {};
  switch (cmd_type) {
    case "date": {
      const d = moment(cmd_type_data, ["YYYY-MM-DD"]);
      if (!d.isValid()) throw new Error("invalid date");
      query = {
        date: {
          $gte: d.startOf("day").toDate(),
          $lte: d.endOf("day").toDate(),
        },
        source: cmd_source,
      };
      break;
    }

    case "movie": {
      if (!(await db.findOne({ name: cmd_type_data })))
        throw new Error("no movie found");
      query = { name: cmd_type_data, source: cmd_source };
      break;
    }

    default:
      throw new Error("invalid args");
  }

  // update nedb
  await worker();

  const data = {};
  const dumpDir = "store/dump";

  for (const { date, key, name, source } of await db
    .find(query)
    .sort({ date: 1 })) {
    const d = moment(date);
    const file = path.resolve(
      dumpDir,
      `${source}/${name}/${key}.${d.format("YYYY-MM-DD")}.csv`
    );
    if (fs.existsSync(file)) {
      await new Promise(async (resolve, reject) => {
        console.log(file);

        const _id = cmd_type === "date" ? name : d.format("MMMDddd");
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
              if (!ref.hf) ref.hf = [0];
              if (!ref.shows) ref.shows = 0;
              if (!ref.sum) ref.sum = 0;

              ref.booked += booked;
              ref.capacity += capacity;
              ref.hf.push(0.99 < booked / capacity);
              if (_change !== ref._change) {
                ref.shows += 1;
                if (ref.hf.slice(1).every((i) => i)) ref.hf[0] += 1;
                ref.hf.splice(1);
                ref._change = _change;
              }
              ref.sum += sum;
            }
            ref.occupancy = ref.booked / ref.capacity;
            resolve(true);
          });
      });
    }
  }

  let height = 8192;

  const columns = [
    { title: cmd_type === "date" ? "Movie" : "Date" },
    { title: "Gross", options: { textAlign: "right" } },
    { title: "Shows", options: { textAlign: "right" } },
    { title: "Occupancy" },
  ];
  const devicePixelRatio = 2;
  const events = {
    tableCreated: (canvas, x, y) => {
      height = Math.ceil(y) + 20;
    },
  };
  const imgPath = path.resolve(dumpDir, "aggregate.png");
  const options = {
    borders: {
      column: { width: 1, color: "#E0E0E0" },
      header: { width: 1, color: "#E0E0E0" },
      row: { width: 1, color: "#E0E0E0" },
      table: { width: 1, color: "#E0E0E0" },
    },
    devicePixelRatio,
    fit: true,
    header: { background: "#E0E0E0" },
    subtitle: { text: `${cmd_source} boxoffice data` },
    title: {
      text: `#${
        cmd_type === "date"
          ? moment(cmd_type_data, ["YYYY-MM-DD"]).format("MMMDddd")
          : cmd_type_data
      }`,
    },
  };
  const width = 640;

  const ctx = new CanvasTable(createCanvas(width, height), {
    columns,
    data: orderBy(
      Object.values(data),
      cmd_type === "date" ? ["shows"] : ["name"],
      "desc"
    ).map((i, j) => {
      const k = [
        i._id,
        `₹${toLocaleNumber(i.sum)}`,
        `${toLocaleNumber(i.shows)}`, // `${i.hf[0] ? `(${toLocaleNumber(i.hf[0])}HF) ` : ""}${toLocaleNumber(i.shows)}`,
        `${numeral(i.occupancy).format("0%")} (${toLocaleNumber(
          i.booked
        )}/${toLocaleNumber(i.capacity)})`,
      ];
      return j % 2 ? k.map((l) => ({ background: "#F5F5F5", value: l })) : k;
    }),
    events,
    options,
  });
  await ctx.generateTable();
  await ctx.renderToFile(imgPath);
  await sharp(imgPath)
    .extract({
      left: 0,
      width: width * devicePixelRatio,
      top: 0,
      height: height * devicePixelRatio,
    })
    .toFile(`${imgPath}.png`);
  fs.unlinkSync(imgPath);
  fs.renameSync(`${imgPath}.png`, imgPath);

  console.log(query, imgPath);
})();
