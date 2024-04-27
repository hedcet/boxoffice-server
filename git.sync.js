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

const sync = async () => {
  // bms diff store
  const bmsDataPath = path.resolve(dumpDir, bmsDirName);
  if (fs.existsSync(bmsDataPath)) await gitPull(bmsRepoUrl, bmsDirName);
  else await gitClone(bmsRepoUrl, bmsDirName);

  // ptm diff store
  const ptmDataPath = path.resolve(dumpDir, ptmDirName);
  if (fs.existsSync(ptmDataPath)) await gitPull(ptmRepoUrl, ptmDirName);
  else await gitClone(ptmRepoUrl, ptmDirName);
};

module.exports = { sync };
