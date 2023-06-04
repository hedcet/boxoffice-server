// v14 <= node
// sudo apt-get install git
// npm install moment moment-timezone nedb-promises
// node diff.downloader.js

const { execSync } = require("child_process");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { db } = require("./db.js");

const bmsDir = "bms";
const bmsRepoUrl = "https://github.com/HedCET/bms";
const dumpDir = "store/dump";
const ptmDir = "ptm";
const ptmRepoUrl = "https://github.com/HedCET/paytm-movies";

(async () => {
  // bms diff store
  const bmsDataPath = path.resolve(dumpDir, bmsDir);
  if (fs.existsSync(bmsDataPath)) {
    console.log(`git pull ${bmsRepoUrl}`);
    execSync(`git pull`, {
      cwd: path.resolve(bmsDataPath),
      stdio: [0, 1, 2],
    });
  } else {
    console.log(`git clone ${bmsRepoUrl} ${bmsDir}`);
    execSync(`git clone ${bmsRepoUrl} ${bmsDir}`, {
      cwd: path.resolve(dumpDir),
      stdio: [0, 1, 2],
    });
  }

  // ptm diff store
  const ptmDataPath = path.resolve(dumpDir, ptmDir);
  if (fs.existsSync(ptmDataPath)) {
    console.log(`git pull ${ptmRepoUrl}`);
    execSync(`git pull`, {
      cwd: path.resolve(ptmDataPath),
      stdio: [0, 1, 2],
    });
  } else {
    console.log(`git clone ${ptmRepoUrl} ${ptmDir}`);
    execSync(`git clone ${ptmRepoUrl} ${ptmDir}`, {
      cwd: path.resolve(dumpDir),
      stdio: [0, 1, 2],
    });
  }

  // ingest bms data
  for (const dirName of fs.readdirSync(bmsDataPath))
    if (dirName.match(/^[0-9a-z]/i)) {
      const dir = path.resolve(bmsDataPath, dirName);
      if (fs.lstatSync(dir).isDirectory())
        for (const fileName of fs.readdirSync(dir)) {
          const file = path.resolve(dir, fileName);
          if (fs.lstatSync(file).isFile()) {
            const [key, d, ext = ""] = fileName.split(".");
            if (ext.match(/csv/i)) {
              const item = {
                date: moment.tz(d, ["YYYY-MM-DD"], "Asia/Kolkata").toDate(),
                key,
                name: dirName,
                source: bmsDir,
              };
              if (!(await db.findOne(item)))
                console.log(file, await db.insert(item));
            }
          }
        }
    }

  // ingest ptm data
  for (const dirName of fs.readdirSync(ptmDataPath))
    if (dirName.match(/^[0-9a-z]/i)) {
      const dir = path.resolve(ptmDataPath, dirName);
      if (fs.lstatSync(dir).isDirectory())
        for (const fileName of fs.readdirSync(dir)) {
          const file = path.resolve(dir, fileName);
          if (fs.lstatSync(file).isFile()) {
            const [key, d, ext = ""] = fileName.split(".");
            if (ext.match(/csv/i)) {
              const item = {
                date: moment.tz(d, ["YYYY-MM-DD"], "Asia/Kolkata").toDate(),
                key,
                name: dirName,
                source: ptmDir,
              };
              if (!(await db.findOne(item)))
                console.log(file, await db.insert(item));
            }
          }
        }
    }
})();
