const fs = require("fs");
const nedb = require("nedb-promises");
const path = require("path");

const { local } = require("./env.js");
const filename = path.resolve(local, "metadata");

// initialize db
const db = new nedb({
  autoload: true,
  filename,
  timestampData: true,
});

// db.ensureIndex({ fieldName: "date" }, console.error);
// db.ensureIndex({ fieldName: "group" }, console.error);
// db.ensureIndex({ fieldName: "id" }, console.error);
// db.ensureIndex({ fieldName: "name" }, console.error);

const compactDatafile = async () => {
  try {
    const backupPath = filename + ".backup";
    if (fs.existsSync(filename)) {
      fs.copyFileSync(filename, backupPath);
    }

    const tmpFilename = filename + ".tmp";
    const tmpDB = new nedb({
      filename: tmpFilename,
      timestampData: true,
    });

    const documents = await db.find({});
    if (documents.length > 0) {
      await tmpDB.insert(documents);
    }

    if (fs.existsSync(tmpFilename)) {
      fs.renameSync(tmpFilename, filename);
    }

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    console.log(`${documents.length} document(s) optimized`);
    return documents.length;
  } catch (error) {
    console.error("compactDatafile", error);
    throw error;
  }
};

db.compactDatafile = compactDatafile;
db.compactDatafile();
