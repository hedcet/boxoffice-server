const fs = require("fs");
const path = require("path");

const { bmsDir, bmsRepoUrl, dumpDir, ptmDir, ptmRepoUrl } = require("./env.js");
const { gitClone, gitPull } = require("./helper.js");

const sync = () => {
  // bms diff store
  const bmsDataPath = path.resolve(dumpDir, bmsDir);
  if (fs.existsSync(bmsDataPath)) gitPull(bmsRepoUrl, bmsDir);
  else gitClone(bmsRepoUrl, bmsDir);

  // ptm diff store
  const ptmDataPath = path.resolve(dumpDir, ptmDir);
  if (fs.existsSync(ptmDataPath)) gitPull(ptmRepoUrl, ptmDir);
  else gitClone(ptmRepoUrl, ptmDir);
};

module.exports = { sync };
