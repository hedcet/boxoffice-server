const { createCanvas } = require("canvas");
const { CanvasTable } = require("canvas-table");
const fs = require("fs");
const { orderBy } = require("lodash");
const moment = require("moment");
numeral = require("numeral");
const path = require("path");
const sharp = require("sharp");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { db } = require("./db.js");
const { toLocaleNumber } = require("./helper.js");
const { aggregate } = require("./nedb.js");
const { dumpDir, worker } = require("./worker.js");

(async () => {
  let source = process.argv[2] || "bms";
  let type = process.argv[3] || "date";
  let type_payload =
    process.argv[4] || moment().subtract(1, "day").format("YYYY-MM-DD");

  let query = {};
  switch (type) {
    case "date": {
      const d = moment(type_payload, ["YYYY-MM-DD"]);
      if (!d.isValid()) throw new Error("invalid date");
      query = {
        date: {
          $gte: d.startOf("day").toDate(),
          $lte: d.endOf("day").toDate(),
        },
        source,
      };
      break;
    }

    case "movie": {
      if (!(await db.findOne({ name: type_payload })))
        throw new Error("no movie found");
      query = { name: type_payload, source };
      break;
    }

    default:
      throw new Error("invalid args");
  }

  await worker();
  const data = await aggregate(query, type);

  let height = 8192;

  const columns = [
    { title: type === "date" ? "Movie" : "Date" },
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
  const imgPath = path.resolve(dumpDir, "report.png");
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
    subtitle: { text: `${source} boxoffice data` },
    title: {
      text: `#${
        type === "date"
          ? moment(type_payload, ["YYYY-MM-DD"]).format("MMMDddd")
          : type_payload
      }`,
    },
  };
  const width = 640;

  const ctx = new CanvasTable(createCanvas(width, height), {
    columns,
    data: orderBy(
      Object.values(data),
      type === "date" ? ["shows", "sum"] : ["name", "shows"],
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
