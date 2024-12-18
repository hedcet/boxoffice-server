const path = require("path");

const remote = "https://github.com/hedcet/boxoffice";
const qc = process.env.qc || "http://localhost:3030";
const proxy = process.env.proxy;
const local = path.resolve(__dirname, "../store");
const csvPath = path.resolve(local, "csv");

module.exports = { csvPath, local, proxy, qc, remote };
