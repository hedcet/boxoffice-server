const { parseString } = require("fast-csv");
const fs = require("fs");
const { orderBy, pick, round, shuffle } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const sharp = require("sharp");

const { csvPath } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");

const json_path = path.resolve(__dirname, "./store/images.json");
const json = fs.existsSync(json_path)
  ? JSON.parse(fs.readFileSync(json_path, "utf8"))
  : {};

const collageMax = 6;

(async () => {
  const start_date = moment("2024-10-14", ["YYYY-MM-DD"]).startOf("day");
  const end_date = start_date.clone().add(7, "day").startOf("day");

  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  // aggregate
  const data = {};
  for (const i of await db
    .find({ date: { $gte: start_date.toDate(), $lt: end_date.toDate() } })
    .sort({ date: 1 })) {
    const file = path.resolve(
      csvPath,
      `${i.name}/${i.id}.${moment(i.date).format("YYYY-MM-DD")}.csv`
    );
    console.log(file);
    const _id = i.group || i.id;
    if (data[_id])
      data[_id].images = [...data[_id].images, ...(json[i.id] || [])];
    else
      data[_id] = {
        name: i.name,
        images: json[i.id] || [],
        shows: 0,
        booked: 0,
        capacity: 0,
        sum: 0,
      };
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
    Object.values(data).filter((i) => i.images.length),
    ["booked", "sum"],
    ["desc", "desc"]
  );

  for (const item of items.slice(0, collageMax)) {
    for (const i of shuffle(item.images)) {
      const [link, size] = i.split("|");
      if (32 * 1024 < +size) {
        console.log(item.name, link);
        item.sum = toEnIn(item.sum, "en-in", {
          notation: "compact",
        });
        item.image = link;
        item.dominant = (
          await sharp(
            await (
              await fetch(link, {
                headers: { "user-agent": "curl/1.0" },
              })
            ).buffer()
          ).stats()
        ).dominant;
        item.booked = toEnIn(item.booked, "en-in", {
          notation: "compact",
        });
        item.bg =
          "#" +
          Object.values(item.dominant)
            .map((e) => e.toString(16).padStart(2, 0))
            .join("");
        item.fg =
          128 <
          Math.round(
            (item.dominant.r * 299 +
              item.dominant.g * 587 +
              item.dominant.b * 114) /
              1000
          )
            ? "black"
            : "white";
        break;
      }
    }
  }

  console.log(
    items.reduce(
      (m, { name }) => (`${m} #${name}`.length < 240 ? `${m} #${name}` : m),
      `#Kerala #BoxOffice ${start_date.format("MMMD")}/${end_date.format(
        "MMMD"
      )} ${Math.round(end_date.diff(start_date, "week", true))}Week Summary`
    )
  );

  // html generation
  const html_path = path.resolve(__dirname, "./weekly.html");
  const html = fs.existsSync(html_path)
    ? fs.readFileSync(html_path, "utf8")
    : "";
  fs.writeFileSync(
    `${html_path}.html`,
    String.raw({ raw: html.split("$?") }, [
      JSON.stringify(
        items
          .slice(0, collageMax)
          .map((i) => pick(i, ["bg", "booked", "fg", "image", "sum"]))
      ),
    ])
  );
})();
