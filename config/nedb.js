const fs = require("fs");
const nedb = require("nedb-promises");
const path = require("path");

const { local } = require("./env.js");
const { moment } = require("./moment.js");

// initialize db
const db = new nedb({
  autoload: true,
  filename: path.resolve(local, "metadata"),
});

db.ensureIndex({ fieldName: "date" }, console.error);
db.ensureIndex({ fieldName: "group" }, console.error);
db.ensureIndex({ fieldName: "id" }, console.error);
db.ensureIndex({ fieldName: "name" }, console.error);

// only 1 level deep iteration
const syncFileInfo = async (csvPath) => {
  for (const folderName of fs.readdirSync(csvPath))
    if (folderName.match(/^[0-9a-z]/i)) {
      const folder = path.resolve(csvPath, folderName);
      if (fs.lstatSync(folder).isDirectory())
        for (const fileName of fs.readdirSync(folder)) {
          if (fileName.match(/^[0-9a-z]/i)) {
            const file = path.resolve(folder, fileName);
            if (fs.lstatSync(file).isFile()) {
              const [id, d, ext = ""] = fileName.split(".");
              if (ext.match(/csv/i)) {
                const item = {
                  date: moment(d, ["YYYY-MM-DD"]).toDate(),
                  id,
                  name: folderName,
                };
                if (!(await db.findOne(item)))
                  console.log(file, await db.insert(item));
              }
            }
          }
        }
    }
};

module.exports = { db, syncFileInfo };
