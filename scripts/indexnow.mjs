// scripts/indexnow.mjs
// Pings IndexNow (Bing, Yandex, and participating engines) so crawlers pick up
// the site quickly. Run after deploy: `npm run indexnow`.
//
// IndexNow requires a key file reachable at the site root:
//   https://<host>/<KEY>.txt  containing exactly <KEY>
// which lives at public/<KEY>.txt so Vite ships it to the deploy root.

const HOST = "polymarket-whale-cockpit.pages.dev";
const KEY = "26352283dcef9e2436a8ab06978be1b5";

const urlList = [
  `https://${HOST}/`,
  `https://${HOST}/faq`,
  `https://${HOST}/how-it-works`,
];

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList,
};

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

const body = await res.text();
if (res.ok) {
  console.log(`IndexNow OK (${res.status}) — submitted ${urlList.length} URL(s):`);
  for (const u of urlList) console.log(`  ${u}`);
} else {
  console.error(`IndexNow failed (${res.status}): ${body || "(no body)"}`);
  process.exitCode = 1;
}
