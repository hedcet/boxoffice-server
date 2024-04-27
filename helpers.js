// const { execSync } = require("child_process");
const path = require("path");
const simpleGit = require("simple-git");

const { dumpDir } = require("./env.js");

let AI = Math.ceil(Math.random() * 100000);
const autoIncrementString = () =>
  `${new Date().getTime().toString(36)}.${AI++}`;

const gitClone = async (repoUrl, relativeDir) => {
  console.log(`git clone --depth 1 ${repoUrl} ${relativeDir}`);
  // execSync(`git clone ${repoUrl} ${relativeDir}`, {
  //   cwd: path.resolve(dumpDir),
  //   stdio: [0, 1, 2],
  // });
  const git = simpleGit(path.resolve(dumpDir), {
    progress({ method, stage, progress }) {
      console.log(`git.${method} ${stage} stage ${progress}% complete`);
    },
  });
  await git.clone(repoUrl, relativeDir, { "--depth": "1" });
};

const gitPull = async (repoUrl, relativeDir) => {
  console.log(`git pull ${repoUrl}`);
  // execSync(`git pull`, {
  //   cwd: path.resolve(dumpDir, relativeDir),
  //   stdio: [0, 1, 2],
  // });
  const git = simpleGit(path.resolve(dumpDir, relativeDir), {
    progress({ method, stage, progress }) {
      console.log(`git.${method} ${stage} stage ${progress}% complete`);
    },
  });
  await git.pull({ "--rebase": "true" });
};

const randomId = () => Math.random().toString(36).substr(2, 6);

const toEnIn = (value, locale = "en-IN", options = {}) => {
  return value.toLocaleString(locale, options);
};

module.exports = { autoIncrementString, gitClone, gitPull, randomId, toEnIn };
