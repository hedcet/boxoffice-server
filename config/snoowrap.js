const snoowrap = require("snoowrap");

const reddit_client_id = process.env.reddit_client_id || "";
const reddit_client_secret = process.env.reddit_client_secret || "";
const reddit_user_name = process.env.reddit_user_name || "";
const reddit_user_password = process.env.reddit_user_password || "";

const client = new snoowrap({
  userAgent: `bot:${reddit_client_id}:v1.0.0 (by /u/${reddit_user_name}) boxoffice`,
  clientId: reddit_client_id,
  clientSecret: reddit_client_secret,
  username: reddit_user_name,
  password: reddit_user_password,
});

module.exports = { client };
