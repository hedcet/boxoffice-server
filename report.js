const moment = require("moment");
const path = require("path");

require("moment-timezone");
moment.tz.setDefault("Asia/Kolkata");

const { draw } = require("./canvas.table.js");
const { db } = require("./db.js");
const { bmsDir, dumpDir, ptmDir } = require("./env.js");
const { sync: gitSync } = require("./git.sync.js");
const { syncMetadata: nedbSyncMetadata, aggregate } = require("./nedb.js");

(async () => {
  // validate input
  let source = process.argv[2] || "bms";
  let type = process.argv[3] || "date";
  let payload =
    process.argv[4] || moment().subtract(1, "day").format("YYYY-MM-DD");

  let query = {};
  switch (type) {
    case "date": {
      const date = moment(payload, ["YYYY-MM-DD"]);
      if (!date.isValid()) throw new Error("invalid date");
      query = {
        source,
        date: {
          $gte: date.startOf("day").toDate(),
          $lte: date.endOf("day").toDate(),
        },
      };
      break;
    }

    case "movie": {
      if (!(await db.findOne({ name: payload })))
        throw new Error("no movie found");
      query = { source, name: payload };
      break;
    }

    default:
      throw new Error("invalid args");
  }

  gitSync(); // git sync
  await nedbSyncMetadata(bmsDir); // nedb bms folder/file metadata sync
  await nedbSyncMetadata(ptmDir); // nedb ptm folder/file metadata sync
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
