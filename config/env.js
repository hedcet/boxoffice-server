const path = require("path");

const remote = "https://github.com/hedcet/boxoffice";
const qc = process.env.qc || "http://localhost:3030";
const proxy = process.env.proxy;
const local =process.env.local || path.resolve(__dirname, "../store");
const executablePath =
  process.env.executablePath ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const csvPath = path.resolve(local, "csv");

module.exports = { csvPath, executablePath, local, proxy, qc, remote };
