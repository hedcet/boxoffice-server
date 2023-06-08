const toLocaleNumber = (value, locale = "en-IN", options = {}) => {
  return parseInt(
    typeof value === "string" ? value : `${value}`
  ).toLocaleString(locale, options);
};

module.exports = { toLocaleNumber };
