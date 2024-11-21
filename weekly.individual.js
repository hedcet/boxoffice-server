const { parseString } = require("fast-csv");
const fs = require("fs");
const { camelCase, round, shuffle, upperFirst } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const sharp = require("sharp");

const { csvPath, qc } = require("./config/env.js");
const { textWidth, toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");

const json_path = path.resolve(__dirname, "./store/images.json");
const json = fs.existsSync(json_path)
  ? JSON.parse(fs.readFileSync(json_path, "utf8"))
  : {};

const collageGap = 3;
const collageItemWidth = 96;

(async () => {
  const group = "";
  const name = /kathalan/i;
  const displayName = "IamKathalan";
  let image = ""; // bms/ptm image-url
  const start_date = moment("2024-11-07", ["YYYY-MM-DD"]);
  const end_date = moment("2024-11-21", ["YYYY-MM-DD"]);

  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  if (group) {
    const $in = await db.find({ group });
    await db.update(
      { id: { $in: $in.map((i) => i.id) } },
      { $set: { group } },
      { multi: true }
    );
  }

  // aggregate
  const data = {
    Monday: { _name: "Monday" },
    Tuesday: { _name: "Tuesday" },
    Wednesday: { _name: "Wednesday" },
    Thursday: { _name: "Thursday" },
    Friday: { _name: "Friday" },
    Saturday: { _name: "Saturday" },
    Sunday: { _name: "Sunday" },
    _total: { _shows: 0, _booked: 0, _capacity: 0, _sum: 0 },
  };
  const images = [];
  for (const i of await db
    .find({
      date: { $gte: start_date.toDate(), $lt: end_date.toDate() },
      ...(group ? { group } : { name }),
    })
    .sort({ date: 1 })) {
    if (json[i.id])
      for (const image of json[i.id])
        if (!images.includes(image)) images.push(image);
    const date = moment(i.date);
    const d = moment(date).format("dddd");
    const k = `_week_${date.format("W")}`;
    if (!data[d][k]) data[d][k] = 0;
    const file = path.resolve(
      csvPath,
      `${i.name}/${i.id}.${date.format("YYYY-MM-DD")}.csv`
    );
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
            const sum = booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");
            if (capacity) {
              data[d][k] += sum;
              if (data._total._show_id != _show_id) {
                data._total._show_id = _show_id;
                data._total._shows += 1;
              }
              data._total._booked += booked;
              data._total._capacity += capacity;
              data._total._sum += sum;
            }
          }
          resolve(true);
        });
    });
  }
  if (!data._total._shows) throw new Error("shows not found");
  delete data._total._show_id;

  console.log(
    `#${displayName} #Kerala #BoxOffice ${start_date.format(
      "MMMD"
    )}/${end_date.format("MMMD")} ${Math.round(
      end_date.diff(start_date, "week", true)
    )}Week Summary\n├ Gross ~ ₹${toEnIn(data._total._sum, "en-in", {
      notation: "compact",
    })}\n├ Occupancy ~ ${toEnIn(data._total._booked)}${
      data._total._booked
        ? `(${round((data._total._booked / data._total._capacity) * 100, 2)}%)`
        : ""
    }\n├ Shows ~ ${toEnIn(
      data._total._shows
    )}\ngithub.com/hedcet/boxoffice/tree/main/${displayName}`
  );

  // table generation
  const columns = [{ width: 120, dataIndex: "_name" }];
  for (const [i, dataIndex] of Object.values(data)
    .map((i) => Object.keys(i).filter((j) => j.startsWith("_week_")))
    .reduce((m, items) => {
      for (const i of items) if (!m.includes(i)) m.push(i);
      return m;
    }, [])
    .sort()
    .entries()) {
    data._total[dataIndex] = Object.values(data)
      .filter((i) => i[dataIndex])
      .reduce((m, i) => m + i[dataIndex], 0);
    if (i) columns.push("|");
    columns.push({
      width: Math.max(100, textWidth(`${data._total[dataIndex]}`) + 24),
      title: upperFirst(camelCase(dataIndex)),
      dataIndex,
      align: "right",
    });
  }
  columns.push({ width: 10 });
  const dataSource = [];
  for (const i of Object.values(data)) {
    Object.keys(i)
      .filter((j) => j.startsWith("_week_"))
      .map((j) => {
        // if (1000 <= i[j])
        i[j] = `₹${toEnIn(i[j], "en-in", { notation: "compact" })}`;
      });
    dataSource.push("-");
    dataSource.push(i);
  }
  const title = `#${displayName}\n#Kerala #BoxOffice ${start_date.format(
    "MMMD"
  )}/${end_date.format("MMMD")} ${Math.round(
    end_date.diff(start_date, "week", true)
  )}W Summary`;
  const table = `${qc}?data=${encodeURIComponent(
    JSON.stringify({
      columns,
      dataSource,
      title,
      titleStyle: { font: "normal 18px sans-serif" },
    })
  )}&options=${encodeURIComponent(
    JSON.stringify({
      paddingHorizontal: 20,
      paddingVertical: 20,
      titleSpacing: 30,
    })
  )}`;

  if (!image)
    for (const i of shuffle(images)) {
      const [link, size] = i.split("|");
      if (32 * 1024 < +size) {
        image = link;
        break;
      }
    }

  if (image) {
    // collage generation
    const tableBuffer = await (await fetch(table)).buffer();
    const tableInfo = await sharp(tableBuffer).metadata();
    await sharp({
      create: {
        width: collageItemWidth + tableInfo.width,
        height: tableInfo.height,
        channels: 3,
        background: "rgb(255, 255, 255)",
      },
    })
      .composite([
        {
          input: await sharp(
            await (
              await fetch(image, { headers: { "user-agent": "curl/1.0" } })
            ).buffer()
          )
            .resize(collageItemWidth, tableInfo.height)
            .toBuffer(),
          left: 0,
          top: 0,
        },
        { input: tableBuffer, left: collageItemWidth, top: 0 },
      ])
      .jpeg({ mozjpeg: true })
      .toFile(path.resolve(__dirname, "./store/weekly.individual.jpg"));
  } else console.log(table);
})();
