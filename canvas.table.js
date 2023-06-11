const { createCanvas } = require("canvas");
const { CanvasTable } = require("canvas-table");
const fs = require("fs");
const { orderBy } = require("lodash");
const moment = require("moment");
const numeral = require("numeral");
const path = require("path");
const sharp = require("sharp");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { dumpDir } = require("./env.js");
const { randomId, toLocaleNumber } = require("./helper.js");

const draw = async (data, config = {}) => {
  let height = 8192;

  const columns = [
    { title: config.type === "date" ? "Movie" : "Date" },
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
  const imgPath = path.resolve(dumpDir, `${randomId()}.png`);
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
    subtitle: {
      multiline: true,
      text: `${config.source} boxoffice data`,
      textAlign: "left",
    },
    title: {
      text: `#${
        config.type === "date"
          ? moment(config.payload, ["YYYY-MM-DD"]).format("MMMDddd")
          : config.payload
      }`,
      textAlign: "left",
    },
  };
  const width = 640;

  const ctx = new CanvasTable(createCanvas(width, height), {
    columns,
    data: orderBy(
      Object.values(data),
      config.type === "date" ? ["sum", "shows"] : ["name", "shows"],
      "desc"
    )
      .filter((i) => 100 <= i.shows)
      .map((i, j) => {
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
    .toFile(config.imgPath);
  fs.unlinkSync(imgPath);

  return { data, config };
};

module.exports = { draw };
