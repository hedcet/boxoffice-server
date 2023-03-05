// v14 <= node
// npm install fast-csv lodash moment node-fetch@2
// node headcet.js

const bmsTrackerMovieNames = [
  "AvatarTheWayOfWater",
  "BheeshmaParvam",
  "Pathaan",
];
const bmsTrackerUrl = "https://api.github.com/repos/HedCET/bms/contents";
const paytmTrackerMovieNames = [
  "AvatarTheWayOfWater",
  "BheeshmaParvam",
  "Pathaan",
];
const paytmTrackerUrl =
  "https://api.github.com/repos/HedCET/paytm-movies/contents";
const storePath = "store";

const { rejects } = require("assert");
const { parseFile, parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
const { orderBy } = require("lodash");
const moment = require("moment");
const fetch = require("node-fetch");
const path = require("path");

(async () => {
  // bms diff store
  for (const movieName of bmsTrackerMovieNames) {
    console.log("downloading", `${bmsTrackerUrl}/${movieName}`);
    const r = await fetch(`${bmsTrackerUrl}/${movieName}`);
    for (const movieFile of await r.json()) {
      const match = movieFile.name.match(/^(.*)\.(\d\d\d\d-\d\d-\d\d)/);
      const movieFilePath = path.resolve(
        storePath,
        `bms.${match[1]}.${match[2]}.csv`
      );
      if (!fs.existsSync(movieFilePath)) {
        console.log("downloading", movieFilePath);
        const r = await fetch(movieFile.download_url);
        await new Promise(async (resolve, reject) => {
          const csvData = [];
          parseString(await r.text(), { headers: true })
            .on("error", reject)
            .on("data", (row) => csvData.push({ ...row, Movie: movieName }))
            .on("end", () =>
              writeToPath(movieFilePath, csvData, { headers: true })
                .on("error", reject)
                .on("finish", resolve)
            );
        });
      }
    }
  }

  // paytm diff store
  for (const movieName of paytmTrackerMovieNames) {
    const r = await fetch(`${paytmTrackerUrl}/${movieName}`);
    for (const movieFile of await r.json()) {
      const match = movieFile.name.match(/^(.*)\.(\d\d\d\d-\d\d-\d\d)/);
      const movieFilePath = path.resolve(
        storePath,
        `paytm.${match[1]}.${match[2]}.csv`
      );
      if (!fs.existsSync(movieFilePath)) {
        console.log("downloading", movieFilePath);
        const r = await fetch(movieFile.download_url);
        await new Promise(async (resolve, reject) => {
          const csvData = [];
          parseString(await r.text(), { headers: true })
            .on("error", reject)
            .on("data", (row) => csvData.push({ ...row, Movie: movieName }))
            .on("end", () =>
              writeToPath(movieFilePath, csvData, { headers: true })
                .on("error", reject)
                .on("finish", resolve)
            );
        });
      }
    }
  }

  // dedup bms+paytm state+city+cinema
  const dedupFilePath = path.resolve(storePath, "dedup.json");
  const dedup = fs.existsSync(dedupFilePath)
    ? JSON.parse(fs.readFileSync(dedupFilePath, "utf8"))
    : {};
  for (const file of fs.readdirSync(storePath))
    if (file.match(/\.csv$/i)) {
      const movieFilePath = path.resolve(storePath, file);
      await new Promise((resolve, reject) => {
        parseFile(movieFilePath, { headers: true })
          .on("error", reject)
          .on("data", ({ State, City, Name }) => {
            if (!dedup[State]) dedup[State] = {};
            if (!dedup[State][City]) dedup[State][City] = {};
            if (!dedup[State][City][Name]) {
              console.log("validate", `${State}|${City}|${Name}`);
              dedup[State][City][Name] = `${State}|${City}|${Name}`;
            }
          })
          .on("end", resolve);
      });
    }
  fs.writeFileSync(dedupFilePath, JSON.stringify(dedup, undefined, 2));

  // TODO: calculate dedup sum
})();
