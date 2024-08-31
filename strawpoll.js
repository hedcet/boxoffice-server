const fetch = require("node-fetch");

fetch("https://api.strawpoll.com/v3/polls", {
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.API_KEY,
  },
  method: "post",
  body: JSON.stringify({
    type: "multiple_choice",
    title: 'how would you rate "Bharathanatyam" movie?',
    poll_options: [
      { value: "very good" },
      { value: "good" },
      { value: "average" },
      { value: "below average" },
    ],
  }),
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
