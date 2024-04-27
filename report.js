const path = require("path");

const { draw } = require("./canvas.table.js");
const { db } = require("./db.js");
const { bmsDirName, dumpDir, ptmDirName } = require("./env.js");
const { sync: gitSync } = require("./git.sync.js");
const { moment } = require("./moment.js");
const { syncMetadata: nedbSyncMetadata, aggregate } = require("./nedb.js");

(async () => {
  await gitSync(); // git clone/pull

  await nedbSyncMetadata(bmsDirName); // sync bms folder/file metadata to nedb
  await nedbSyncMetadata(ptmDirName); // sync ptm folder/file metadata to nedb

  // validate args
  let source = process.argv[2] || "bms";
  let type = process.argv[3] || "date";
  let payload =
    process.argv[4] || moment().subtract(1, "day").format("YYYY-MM-DD"); // default yesterday's date

  let query = {};
  switch (type) {
    case "date": {
      const date = moment(payload, ["YYYY-MM-DD"]);
      if (!date.isValid()) throw new Error("invalid date");
      query = {
        source,
        date: {
          $gte: date.clone().startOf("day").toDate(),
          $lte: date.clone().endOf("day").toDate(),
        },
      };
      break;
    }

    case "movie": {
      const name = new RegExp(payload); // accept RegExp
      if (!(await db.findOne({ name }))) throw new Error("movie not found");
      query = { source, name };
      break;
    }

    default:
      throw new Error("invalid args");
  }

  const data = await aggregate(query, type); // csv read & aggregate
  const {
    config: { imgPath },
  } = await draw(data, {
    type,
    payload,
    imgPath: path.resolve(dumpDir, "report.png"),
    source,
  }); // generate table image

  console.log(query, imgPath);
})();
