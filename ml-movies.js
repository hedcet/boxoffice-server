const fs = require("fs");
const { orderBy, pick } = require("lodash");
const path = require("path");

const { moment } = require("./config/moment.js");

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

const cache_path = path.resolve(__dirname, "./ml-movies.json");
const cache = JSON.parse(fs.readFileSync(cache_path, "utf8"));

const movies =
  // orderBy(
  //   configs.filter((i) => i.enable),
  //   ["releaseDate"],
  //   ["desc"]
  // )
  //   .filter((i) => moment().diff(i.releaseDate, "months") <= 3)
  configs
    .filter((i) => i.enable)
    .slice(0, process.argv[2] ? +process.argv[2] : 10)
    .map((i) => ({
      id: i.ltrbxd_slug,
      image_uri: i.image,
      title: i.name,
      original_title: i.originalName,
      secondary_key: `Driector${
        Object.values(i.director).length > 1 ? "s" : ""
      }`,
      secondary_value: Object.values(i.director).join(" | "),
      ...pick(i, [
        "half",
        "one",
        "one_half",
        "two",
        "two_half",
        "three",
        "three_half",
        "four",
        "four_half",
        "five",
      ]),
    }));

cache.movies = movies;

const images = cache.movies.map((i) => i.image_uri).filter((i) => i);
for (const image of Object.keys(cache.refs))
  if (!images.includes(image)) delete cache.refs[image];

fs.writeFileSync(cache_path, JSON.stringify(cache, null, 2));
