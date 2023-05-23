// mongosh "mongodb://ip:port/db" dedup/export.js --quiet > out.json

data = db.cities
  .aggregate([
    {
      $lookup: {
        from: "cinemas",
        localField: "_id",
        foreignField: "city",
        as: "cinemas",
      },
    },
    { $unwind: "$cinemas" },
    {
      $group: {
        _id: "$state",
        cinemas: { $push: { name: "$cinemas.name", zip: "$cinemas.zip" } },
        sum: { $sum: 1 },
      },
    },
    { $sort: { sum: -1 } },
  ])
  .toArray();

print(JSON.stringify(data, undefined, 2));
