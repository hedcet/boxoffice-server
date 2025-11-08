const express = require("express");
const { groupBy, orderBy, sample } = require("lodash");
const path = require("path");

const { colors } = require("./config/colors.js");
const { csvPath } = require("./config/env.js");
const { sync } = require("./config/git.js");
const { randomId } = require("./config/misc.js");
const { moment } = require("./config/moment.js");
const { db, syncFileInfo } = require("./config/nedb.js");

(async () => {
  await sync(csvPath); // git clone/pull
  await syncFileInfo(csvPath); // sync folder/file metadata to nedb

  const _colors = {};
  const get_color = (k = "") => {
    if (!_colors[k]) _colors[k] = sample(colors);
    return _colors[k];
  };

  const app = express();
  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({ status: 200 });
  });

  app.get("/group", async (req, res) => {
    const data = await db.find({}); // date: { $gt: moment().subtract(6, "month").toDate() },
    const r = [];
    for (const items of orderBy(
      Object.values(groupBy(data, "id")),
      [(i) => i[0].name],
      ["asc"]
    )) {
      const [f] = orderBy(items, ["createdAt", "date"], ["asc", "asc"]);
      const created_at = moment(f.createdAt || f.date).format("YYYY-MM-DD");
      r.push({
        color: get_color(items[0].group || created_at),
        created_at,
        group: items[0].group,
        hits: items.length,
        name: orderBy(items, [(i) => i.name.length], ["asc"])[0].name,
        refs: items.map((i) => i.id),
      });
    }
    res.json(r);
  });

  app.post("/group", async (req, res) => {
    const group = randomId();
    await db.update(
      { id: { $in: req.body.refs } },
      { $set: { group } },
      { multi: true }
    );
    res.end('<head><meta http-equiv="refresh" content="1"></head>');
  });

  app.get("/group_", (req, res) => {
    res.sendFile(path.join(__dirname, "./group.html"));
  });

  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`server listening on port ${port}`));
})();
