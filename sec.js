const { createHash } = require("crypto");
const { writeToPath } = require("fast-csv");
// const fs = require("fs");
// const { HttpsProxyAgent } = require("https-proxy-agent");
const { shuffle, startCase } = require("lodash");
const nedb = require("nedb-promises");
const { AbortController } = require("node-abort-controller");
const fetch = require("node-fetch");
const tesseract = require("node-tesseract-ocr");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const userAgents = require("user-agents");
const { isJSON } = require("validator");

const { local, proxy } = require("./config/env.js");

const db = new nedb({
  autoload: true,
  filename: path.resolve(local, "sec"),
});

puppeteer.use(require("puppeteer-extra-plugin-stealth")());

let browser;
let page;
async function getPage() {
  if (page) return page;
  browser = await puppeteer.launch({
    args: ["--disable-setuid-sandbox", "--lang=en-US,en", "--no-sandbox"],
    devtools: false,
    headless: false,
    ignoreHTTPSErrors: true,
  });
  [page] = await browser.pages();
  return page;
}

async function request(url, options = {}) {
  // if (!options.agent && proxy) options.agent = new HttpsProxyAgent(proxy);
  if (!options.headers) options.headers = {};
  if (!options.headers["User-Agent"])
    options.headers["User-Agent"] = new userAgents({
      deviceCategory: "desktop",
    }).toString();
  if (!options.headers.Referer)
    options.headers.Referer =
      "https://sec.kerala.gov.in/election/candidate/viewCandidate";
  if (options.method?.match(/post/i) && !options.headers["Content-Type"])
    options.headers["Content-Type"] =
      "application/x-www-form-urlencoded; charset=UTF-8";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000 * 15);
  const r = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(timeout);
  if (!r.ok) throw new Error(`${r.status}|${r.statusText}`);
  // if (options.__filename) {
  //   const __filepath = path.resolve(local, options.__filename);
  //   fs.writeFileSync(__filepath, await r.buffer());
  //   return { __filepath };
  // }
  const text = await r.text();
  if (isJSON(text)) return JSON.parse(text);
  return text;
}

const retry = new Map();
async function request_with_retry(url, options = {}, maxRetry = 3) {
  const v = `${url}|${JSON.stringify(options)}`;
  const key = createHash("md5").update(v).digest("hex");
  for (let i = 0; i < maxRetry; i++) {
    console.log("request_with_retry", v, key);
    try {
      return await request(url, options);
    } catch (e) {
      const count = (retry.get(key) || 0) + 1;
      console.log("request_with_retry", key, count, e.message || e);
      if (maxRetry <= count) throw e;
      retry.set(key, count);
      await new Promise((r) => setTimeout(r, 1000 * 60 * count));
    }
  }
}

const districts = {
  1: "KASARGOD",
  2: "KANNUR",
  3: "WAYANAD",
  4: "KOZHIKODE",
  5: "MALAPPURAM",
  6: "PALAKKAD",
  7: "THRISSUR",
  8: "ERNAKULAM",
  9: "IDUKKI",
  10: "KOTTAYAM",
  11: "ALAPPUZHA",
  12: "PATHANAMTHITTA",
  13: "KOLLAM",
  14: "THIRUVANANTHAPURAM",
};

(async () => {
  // // district
  // for (const [k, v] of shuffle(Object.entries(districts))) {
  //   const [district_id, district_name] = [k.trim(), startCase(v)];
  //   if (!(await db.findOne({ district_id })))
  //     console.log(await db.insert({ district_id, district_name }));
  // }

  // // lb
  // for (const { district_id, district_name } of shuffle(
  //   await db.find({ lb_id: { $exists: false } })
  // )) {
  //   if (await db.findOne({ district_id, lb_id: { $exists: true } })) continue;
  //   try {
  //     const r = await request_with_retry(
  //       "https://sec.kerala.gov.in/public/getalllbcmpdb/byd",
  //       {
  //         body: new URLSearchParams({ objid: district_id }).toString(),
  //         method: "POST",
  //       }
  //     );
  //     if (!r.ops1) throw new Error("invalid response");
  //     for (const { value: lb_id, text } of r.ops1) {
  //       const [code, name] = text.split("-");
  //       const [lb_code, lb_name] = [code.trim(), startCase(name)];
  //       if (!lb_code || !lb_name) throw new Error("invalid lb code/name");
  //       const lb = { district_id, district_name, lb_code, lb_id, lb_name };
  //       if (!(await db.findOne(lb))) console.log(await db.insert(lb));
  //     }
  //   } catch (e) {
  //     console.error("=====lb=====", e.message || e);
  //   }
  // }

  // // ward
  // for (const { district_id, district_name, lb_code, lb_id, lb_name } of shuffle(
  //   await db.find({ lb_id: { $exists: true }, ward_id: { $exists: false } })
  // )) {
  //   if (await db.findOne({ lb_id, ward_id: { $exists: true } })) continue;
  //   try {
  //     const r = await request_with_retry(
  //       "https://sec.kerala.gov.in/public/getward/bylb",
  //       {
  //         body: new URLSearchParams({ objid: lb_id }).toString(),
  //         method: "POST",
  //       }
  //     );
  //     if (!r.ops1) throw new Error("invalid response");
  //     for (const { value: ward_id, text } of r.ops1) {
  //       const [code, name] = text.split("-");
  //       const [ward_code, ward_name] = [code.trim(), startCase(name)];
  //       if (!ward_code || !ward_name) throw new Error("invalid ward code/name");
  //       const ward = {
  //         district_id,
  //         district_name,
  //         lb_code,
  //         lb_id,
  //         lb_name,
  //         ward_code,
  //         ward_id,
  //         ward_name,
  //       };
  //       if (!(await db.findOne(ward))) console.log(await db.insert(ward));
  //     }
  //   } catch (e) {
  //     console.error("=====ward=====", e.message || e);
  //   }
  // }

  // // candidate
  // const filepath = path.resolve(local, "sec.png");
  // const maxRetry = 3;
  // for (const {
  //   district_id,
  //   district_name,
  //   lb_code,
  //   lb_id,
  //   lb_name,
  //   ward_code,
  //   ward_id,
  //   ward_name,
  // } of shuffle(
  //   await db.find({
  //     ward_id: { $exists: true },
  //     candidate_name: { $exists: false },
  //   })
  // )) {
  //   if (await db.findOne({ ward_id, candidate_name: { $exists: true } }))
  //     continue;
  //   try {
  //     console.log(
  //       district_name,
  //       lb_name,
  //       ward_name,
  //       `${district_id}|${lb_id}|${ward_id}`
  //     );
  //     const page = await getPage();
  //     if (!page) throw new Error("invalid page");
  //     await page.goto(
  //       "https://sec.kerala.gov.in/election/candidate/viewCandidate",
  //       { waitUntil: "networkidle2" }
  //     );
  //     await page.select('[name="candidate_view[district]"]', district_id);
  //     await page.waitForFunction(() => {
  //       const lb = document.querySelector('[name="candidate_view[localBody]"]');
  //       return lb && 1 < lb.options.length;
  //     });
  //     await page.select('[name="candidate_view[localBody]"]', lb_id);
  //     await page.waitForFunction(() => {
  //       const ward = document.querySelector('[name="candidate_view[ward]"]');
  //       return ward && 1 < ward.options.length;
  //     });
  //     await page.select('[name="candidate_view[ward]"]', ward_id);
  //     for (let i = 0; i < maxRetry; i++) {
  //       await (
  //         await page.$('form[name="candidate_view"] img.captcha_image')
  //       ).screenshot({ path: filepath });
  //       const captcha = (await tesseract.recognize(filepath))
  //         .replace(/[^0-9a-z]+/gi, "")
  //         .toLowerCase();
  //       if (captcha.length !== 5) continue;
  //       await page.type('[name="candidate_view[captcha]"]', captcha);
  //       await Promise.all([
  //         page.click('button[name="candidate_view[Search]"]'),
  //         page.waitForNavigation({ timeout: 1000 * 3 }),
  //       ]);
  //       if (await page.$(".view_candidate_status_list table tbody tr")) break;
  //       console.error(
  //         "invalid captcha",
  //         `${district_id}|${lb_id}|${ward_id}`,
  //         i + 1,
  //         captcha
  //       );
  //     }
  //     if (!(await page.$(".view_candidate_status_list table tbody tr")))
  //       throw new Error("invalid captcha");
  //     const candidates = await page.evaluate(() => {
  //       const rows = document.querySelectorAll(
  //         ".view_candidate_status_list table tbody tr"
  //       );
  //       const result = [];
  //       for (const row of rows) {
  //         const cols = row.querySelectorAll("td");
  //         const candidate_name =
  //           cols[1]
  //             .querySelector("strong")
  //             ?.textContent.replace(/\s+/g, " ")
  //             .trim() || "";
  //         const match = cols[1].textContent.match(/\b\d{10}\b/);
  //         const candidate_mobile_no = match ? match[0] : "";
  //         const candidate_party =
  //           cols[2]
  //             .querySelector("strong")
  //             ?.textContent.replace(/\s+/g, " ")
  //             .trim() || "";
  //         const candidate_symbol =
  //           cols[3]
  //             .querySelector("strong")
  //             ?.textContent.replace(/\s+/g, " ")
  //             .trim() || "";
  //         result.push({
  //           candidate_name,
  //           candidate_mobile_no,
  //           candidate_party,
  //           candidate_symbol,
  //         });
  //       }
  //       return result;
  //     });
  //     if (!candidates.length) throw new Error("no candidates found");
  //     for (const candidate of candidates) {
  //       const ref = {
  //         district_id,
  //         district_name,
  //         lb_code,
  //         lb_id,
  //         lb_name,
  //         ward_code,
  //         ward_id,
  //         ward_name,
  //         ...candidate,
  //       };
  //       if (!(await db.findOne(ref))) console.log(await db.insert(ref));
  //     }
  //     // await new Promise((r) => setTimeout(r, 1000 * 60 * 15));
  //   } catch (e) {
  //     console.error("=====candidate=====", e.message || e);
  //   }
  // }

  // csv
  const candidates = await db
    .find({ candidate_name: { $exists: true } })
    .sort({ district_id: 1, lb_code: 1, ward_code: 1 });
  await new Promise((resolve, reject) => {
    writeToPath(path.resolve(local, "sec.csv"), candidates, { headers: true })
      .on("error", reject)
      .on("finish", resolve);
  });
})();
