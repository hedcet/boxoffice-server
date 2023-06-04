// v14 <= node
// npm install fast-csv node-fetch@2
// node diff.downloader.js

const bmsTrackerMovieNames = ["Neymar"];
const bmsTrackerUrl = "https://api.github.com/repos/HedCET/bms/contents";
const paytmTrackerMovieNames = ["Neymar"];
const paytmTrackerUrl =
  "https://api.github.com/repos/HedCET/paytm-movies/contents";
const storePath = "store/dump";

const { parseString, writeToPath } = require("fast-csv");
const fs = require("fs");
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
        `${movieName}.bms.${match[1]}.${match[2]}.csv`
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
        `${movieName}.paytm.${match[1]}.${match[2]}.csv`
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
})();
