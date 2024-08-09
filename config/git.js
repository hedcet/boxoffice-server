// const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");

const { local, remote } = require("./env.js");

const gitClone = async (repo, relativePath) => {
  console.log(`git clone --depth 1 ${repo} ${relativePath}`);
  // execSync(`git clone --depth 1 ${repo} ${relativePath}`, {
  //   cwd: path.resolve(local),
  //   stdio: [0, 1, 2],
  // });
  const git = simpleGit(path.resolve(local), {
    progress({ method, stage, progress }) {
      console.log(`git.${method} ${stage} stage ${progress}% complete`);
    },
  });
  await git.clone(repo, relativePath, { "--depth": "1" });
};

const gitPull = async (repo, relativePath) => {
  console.log(`git pull ${repo}`);
  // execSync(`git pull`, {
  //   cwd: path.resolve(local, relativePath),
  //   stdio: [0, 1, 2],
  // });
  const git = simpleGit(path.resolve(local, relativePath), {
    progress({ method, stage, progress }) {
      console.log(`git.${method} ${stage} stage ${progress}% complete`);
    },
  });
  await git.pull({ "--rebase": "true" });
};

// diff sync
const sync = async (csvPath) => {
  if (fs.existsSync(csvPath)) await gitPull(remote, csvPath);
  else await gitClone(remote, csvPath);
};

module.exports = { sync };
