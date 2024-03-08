const fs = require("fs");
const path = require("path");

const {
  bmsDirName,
  bmsRepoUrl,
  dumpDir,
  ptmDirName,
  ptmRepoUrl,
} = require("./env.js");
const { gitClone, gitPull } = require("./helpers.js");

const sync = () => {
  // bms diff store
  const bmsDataPath = path.resolve(dumpDir, bmsDirName);
  if (fs.existsSync(bmsDataPath)) gitPull(bmsRepoUrl, bmsDirName);
  else gitClone(bmsRepoUrl, bmsDirName);

  // ptm diff store
  const ptmDataPath = path.resolve(dumpDir, ptmDirName);
  if (fs.existsSync(ptmDataPath)) gitPull(ptmRepoUrl, ptmDirName);
  else gitClone(ptmRepoUrl, ptmDirName);
};

module.exports = { sync };
