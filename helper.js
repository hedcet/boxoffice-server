const { execSync } = require("child_process");
const path = require("path");

const { dumpDir } = require("./env.js");

const gitClone = (repoUrl, relativeDir) => {
  console.log(`git clone ${repoUrl} ${relativeDir}`);
  execSync(`git clone ${repoUrl} ${relativeDir}`, {
    cwd: path.resolve(dumpDir),
    stdio: [0, 1, 2],
  });
};

const gitPull = (repoUrl, relativeDir) => {
  console.log(`git pull ${repoUrl}`);
  execSync(`git pull`, {
    cwd: path.resolve(dumpDir, relativeDir),
    stdio: [0, 1, 2],
  });
};

const randomId = () => Math.random().toString(36).substr(2, 6);

const toLocaleNumber = (value, locale = "en-IN", options = {}) => {
  return parseInt(
    typeof value === "string" ? value : `${value}`
  ).toLocaleString(locale, options);
};

module.exports = { gitClone, gitPull, randomId, toLocaleNumber };
