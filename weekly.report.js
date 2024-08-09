const { parseString } = require("fast-csv");
const fs = require("fs");
const path = require("path");

const { csvPath, qc } = require("./config/env.js");
const { toEnIn } = require("./config/misc.js");
const { sync } = require("./config/git.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");

(async () => {
  const name = /devadoothan/i;
  const displayName = "Devadoothan";
  const from = moment("2024-07-26", ["YYYY-MM-DD"]);
  const to = moment();

  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb
  if (!(await db.findOne({ name }))) throw new Error("name not found");

  // aggregate
  const data = {
    Monday: { _name: "Monday" },
    Tuesday: { _name: "Tuesday" },
    Wednesday: { _name: "Wednesday" },
    Thursday: { _name: "Thursday" },
    Friday: { _name: "Friday" },
    Saturday: { _name: "Saturday" },
    Sunday: { _name: "Sunday" },
  };
  let date;
  let weekIndex = 1;
  for (const i of await db
    .find({ name, date: { $gte: from.toDate(), $lt: to.toDate() } })
    .sort({ date: 1 })) {
    date = moment(i.date);
    const d = moment(date).format("dddd");
    const k = `_week_${weekIndex}`;
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
            // const _id = `${j.City}|${j.Name}|${j.Language}|${j["Time(IST)"]}`; // unique show id
            const booked = +j.Booked.replace(/[^0-9]+/g, "");
            // const capacity = +j.Capacity.replace(/[^0-9]+/g, "");
            const sum = booked * +j.Price.split(".")[0].replace(/[^0-9]+/g, "");
            data[d][k] += sum;
          }
          resolve(true);
        });
    });
    if (d === "Sunday") weekIndex += 1;
  }
  if (!date) throw new Error("data not found");

  const columns = [{ width: 120, dataIndex: "_name" }];
  for (let i = 1; i <= weekIndex; i++) {
    const dataIndex = `_week_${i}`;
    if (!data._total) data._total = {};
    data._total[dataIndex] = Object.values(data)
      .filter((i) => i[dataIndex])
      .reduce((m, i) => m + i[dataIndex], 0);
    columns.push("|");
    columns.push({
      width: 120,
      title: `Week ${i}`,
      dataIndex,
      align: "right",
    });
  }
  const title = `#${displayName}\n#Kerala #BoxOffice ₹${toEnIn(
    Object.values(data._total).reduce((m, i) => m + i, 0),
    "en-in",
    { notation: "compact" }
  )} ${from.format("MMMD")}/${date.format("MMMD")}`;
  const dataSource = [];
  for (const i of Object.values(data)) {
    Object.keys(i)
      .filter((j) => j.startsWith("_week_"))
      .map((j) => {
        if (1000 <= i[j])
          i[j] = `₹${toEnIn(i[j], "en-in", { notation: "compact" })}`;
      });
    dataSource.push("-");
    dataSource.push(i);
  }

  console.log(
    `${qc}?data=${encodeURIComponent(
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
    )}`
  );
})();
