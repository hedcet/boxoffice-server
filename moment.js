const moment = require("moment");
require("moment-timezone");

moment.tz.setDefault("Asia/Kolkata");

module.exports = { moment };
