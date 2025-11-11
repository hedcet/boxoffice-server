const { parseString } = require("fast-csv");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { orderBy, round, shuffle, startCase } = require("lodash");
const fetch = require("node-fetch");
const path = require("path");
const { launch } = require("puppeteer");
const sharp = require("sharp");

const { csvPath, executablePath, local, proxy } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");

const json_path = path.resolve(__dirname, "./store/data.json");
const json = fs.existsSync(json_path)
  ? JSON.parse(fs.readFileSync(json_path, "utf8"))
  : {};

const collageMax = 6;

(async () => {
  const start_date = moment("2025-11-03", ["YYYY-MM-DD"]).startOf("day");
  const end_date = start_date.clone().add(7, "day").startOf("day");

  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  const history = {};
  for (const { group } of await db.find({
    date: { $gte: start_date.toDate(), $lt: end_date.toDate() },
    group: { $exists: true },
  })) {
    const groups = await db.find({ group });
    history[group] = groups.map((i) => i.id);
    await db.update(
      { id: { $in: groups.map((i) => i.id) } },
      { $set: { group } },
      { multi: true }
    );
  }

  const images = {};
  for (const [group, list] of Object.entries(history))
    for (const id of list)
      for (const image of json[id]?.images || []) {
        if (!images[group]) images[group] = [];
        if (!images[group].includes(image)) images[group].push(image);
      }

  // aggregate
  const data = {};
  for (const i of await db
    .find({ date: { $gte: start_date.toDate(), $lt: end_date.toDate() } })
    .sort({ date: 1 })) {
    const file = path.resolve(
      csvPath,
      `${i.name}/${i.id}.${moment(i.date).format("YYYY-MM-DD")}.csv`
    );
    const _id = i.group || i.id;
    if (!data[_id])
      data[_id] = {
        name: i.name,
        images: images[i.group] || json[i.id]?.images || [],
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
            const show_id = `${j.City}|${j["Time(IST)"]}|${j.Name}|${j.Language}|${i.Format}`; // unique show id
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

  console.log(data);
  const items = orderBy(
    Object.values(data).filter((i) => i.images.length),
    ["booked", "sum"],
    ["desc", "desc"]
  );

  // console.log(
  //   items.reduce(
  //     (m, { name }) => (`${m} #${name}`.length < 240 ? `${m} #${name}` : m),
  //     `#Kerala #BoxOffice ${start_date.format("MMMD")}/${end_date.format(
  //       "MMMD"
  //     )} ${Math.round(end_date.diff(start_date, "week", true))}Week Summary`
  //   )
  // );

  console.log(
    items
      .slice(0, 6)
      .reduce(
        (m, { name }) => (`${m} #${name}`.length < 240 ? `${m} | #${name}` : m),
        `#Kerala #BoxOffice ${start_date
          .format("Wo")
          .replace(/([0-9]+)(.*)/, "$1'$2")} Week Summary (${start_date.format(
          "MMM DD"
        )} - ${end_date.format("MMM DD YYYY")})`
      )
  );

  // image processing
  for (const item of items.slice(0, collageMax)) {
    for (const i of shuffle(item.images)) {
      const [link, size] = i.split("|");
      if (32 * 1024 < +size) {
        console.log(item.name, link);
        item.image = link;
        item.dominant = (
          await sharp(
            await (
              await fetch(link, {
                ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
                headers: { "user-agent": "curl/1.0" },
              })
            ).buffer()
          ).stats()
        ).dominant;
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

  // other props
  for (const item of items) {
    item.booked_ = toEnIn(item.booked, "en-in", { notation: "compact" });
    item.occupancy = item.booked
      ? `${round((item.booked / item.capacity) * 100, 2)}%`
      : "";
    item.gross = toEnIn(item.sum, "en-in", { notation: "compact" });
  }

  // html generation
  const html_path = path.resolve(__dirname, "./weekly.html");
  const html = fs.existsSync(html_path)
    ? fs.readFileSync(html_path, "utf8")
    : "";
  fs.writeFileSync(
    `${html_path}.html`,
    String.raw({ raw: html.split("$?") }, [
      JSON.stringify(items.slice(0, collageMax)),
    ])
  );

  // screenshot
  const browser = await launch({
    args: [
      "--disable-setuid-sandbox",
      "--lang=en-IN,en",
      "--no-sandbox",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
    executablePath,
    // headless: false,
  });
  let [page] = await browser.pages();
  if (!page) page = await browser.newPage();
  await page.goto(`file:///${path.resolve(__dirname, "./weekly.html.html")}`, {
    waitUntil: "networkidle0",
  });
  await (
    await page.$("#screenshot")
  ).screenshot({
    path: path.resolve(local, "weekly.png"),
  });
  await browser.close();

  // md generation
  let text = `Kerala BoxOffice ${start_date
    .format("Wo")
    .replace(/([0-9]+)(.*)/, "$1^$2")} Week Summary (${start_date.format(
    "MMM DD"
  )} - ${end_date.format(
    "MMM DD YYYY"
  )})\n\n| Movie | Shows | Occupancy↓ | Gross |\n| - | -: | -: | -: |`;
  for (const item of items.slice(0, 15)) {
    // .filter((i) => 30 < i.shows)
    // .filter((i) => 300000 < item.sum)
    const t = `\n| [${startCase(item.name).replace(
      /([A-Z]) (\d) ([A-Z])/g,
      "$1$2 $3"
    )}](https://github.com/hedcet/boxoffice/tree/main/${item.name}) | ${toEnIn(
      item.shows
    )} | ${item.booked_}${item.occupancy ? `(${item.occupancy})` : ""} | ₹${
      item.gross
    } |`;
    if (5000 < `${text}${t}`.length) break;
    text += t;
  }
  text += `\n\n[source](https://github.com/hedcet/boxoffice/commits/main/?since=${start_date
    .clone()
    .add(1, "day")
    .format("YYYY-MM-DD")}&until=${end_date.format(
    "YYYY-MM-DD"
  )}) | last updated at ${moment().format("YYYY-MM-DDTHH:mmZ")}`;
  console.log(text);
})();
