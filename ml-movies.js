const fs = require("fs");
const { orderBy, pick } = require("lodash");
const path = require("path");

const config_path = path.resolve(__dirname, "./letterboxd.kbo.json");
const configs = JSON.parse(fs.readFileSync(config_path, "utf8"));

const cache_path = path.resolve(__dirname, "./ml-movies.json");
const cache = JSON.parse(fs.readFileSync(cache_path, "utf8"));

const movies = orderBy(
  configs.filter((i) => i.enable),
  ["releaseDate"],
  ["desc"]
).map((i) => ({
  id: i.ltrbxd_slug,
  image_uri: i.image,
  title: i.name,
  original_title: i.originalName,
  secondary_key: `Driector${Object.values(i.director).length > 1 ? "s" : ""}`,
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
fs.writeFileSync(cache_path, JSON.stringify(cache, null, 2));
