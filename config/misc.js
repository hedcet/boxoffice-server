let AI = Math.ceil(Math.random() * 100000);
const autoIncrementString = () =>
  `${new Date().getTime().toString(36)}.${AI++}`;

const randomId = () => Math.random().toString(36).substr(2, 6);

const toEnIn = (value, locale = "en-in", options = {}) => {
  return value.toLocaleString(locale, options);
};

module.exports = { autoIncrementString, randomId, toEnIn };
