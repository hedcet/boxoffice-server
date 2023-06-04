const nedb = require("nedb-promises");
const path = require("path");

const dumpDir = "store/dump";

// initialize db
const db = new nedb({
  autoload: true,
  filename: path.resolve(dumpDir, "db.json"),
});

db.ensureIndex({ fieldName: "date" }, console.error);
db.ensureIndex({ fieldName: "key" }, console.error);
db.ensureIndex({ fieldName: "name" }, console.error);

module.exports = { db };
