const { execSync } = require("child_process");
const path = require("path");

const { dumpDir } = require("./env.js");

let AI = Math.ceil(Math.random() * 100000);
const autoIncrementString = () =>
  `${new Date().getTime().toString(36)}.${AI++}`;

const gitClone = (repoUrl, relativeDir) => {
  console.log(`git clone --depth 1 ${repoUrl} ${relativeDir}`);
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

const toEnIn = (value, locale = "en-IN", options = {}) => {
  return value.toLocaleString(locale, options);
};

module.exports = { autoIncrementString, gitClone, gitPull, randomId, toEnIn };
