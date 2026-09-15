# Shared daily high score

This optional service stores one anonymous high score per UK calendar day, game version and game mode. The website continues to use GitHub Pages. The service can use its own `workers.dev` address, so `wycombepunch.com`, CNAME, DNS and HTTPS settings do not need to change.

**Current state: implemented and locally tested; not deployed.** Leave `WP_CONFIG.dailyScore.endpoint` blank until a real service has been deployed and verified. The game hides the daily score while this setting is blank. It never substitutes a browser-only score for a global record.

## What is required

- The owner's Cloudflare account with Workers and D1 available.
- Node.js 24 or later for the included tests, and Wrangler for setup/deployment.
- A D1 database ID and deployed Worker URL. Neither is a secret. No API token belongs in the website.

Cloudflare provides a Free plan for both services. As checked on 15 September 2026, D1 includes 5 million rows read/day, 100,000 rows written/day and 5 GB storage. If the daily D1 allowance is exhausted, queries fail until it resets; this client displays an unavailable state. Check current account allowances before enabling, and do not select a paid plan without the owner's approval. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Deployment

Run these commands from this `backend` directory after the owner has authorised the account setup:

```sh
npm install
npm test
npx wrangler login
npx wrangler d1 create wycombe-punch-daily-score
```

1. Replace `REPLACE_WITH_CREATED_D1_DATABASE_ID` in `wrangler.jsonc` with the returned database ID. Keep the binding named `DB`.
2. The `SCORE_RATE_LIMITER` namespace ID must be unique for this purpose within that Cloudflare account. Change the configured number if it is already used by another Worker. The binding allows 120 requests per minute per network address; it is a basic burst limit that accommodates shared Wi-Fi, not a strict global abuse guarantee. [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
3. Apply the schema, then deploy:

```sh
npx wrangler d1 execute wycombe-punch-daily-score --remote --file=schema.sql
npx wrangler deploy
```

4. Set `dailyScore: { endpoint: 'https://THE_DEPLOYED_WORKER.workers.dev/daily-score' }` in `docs/assets/config.js`, using the actual returned URL. Keep the trailing `/daily-score` path. Publish this setting only after the checks below pass.
5. If a host enforces the existing `docs/_headers` Content Security Policy, add the exact deployed Worker origin to `connect-src`. GitHub Pages does not use that optional host configuration file.
6. Update the website privacy wording to describe anonymous game scores processed by Cloudflare before enabling. The service stores only the day, version, mode, high score and update time in D1. Cloudflare necessarily processes request network information; the Worker uses the connecting address for its temporary rate limiter, with application observability disabled. It does not store names or IP addresses in D1, set cookies, or use browser storage.

The Worker uses parameter-bound D1 queries, with a single `MAX` upsert rather than a read-then-write update. Concurrent submissions cannot replace a higher stored score with a lower one. [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).

## Verify before enabling

- Read `/daily-score?version=2&mode=precision` with an `Origin: https://wycombepunch.com` request header. An empty day must return `highScore: null`, a UK day and a future `resetAt`.
- Test write/read behaviour against a separate staging database first. Three hit scores of `[300, 310, 320]` must give `score: 930`. A later lower submission must not reduce the record. Do not seed fabricated scores in the production database.
- Verify a completed game from the deployed site sends the three hit scores and receives the stored result. In a second browser, reload the page and confirm it displays that same real score.
- Verify the precision and motion-free modes show separate records, changing mode during a pending request cannot display the old mode's score, and a blocked/offline endpoint displays “Daily high score unavailable.”
- Confirm tomorrow's record starts empty at midnight in `Europe/London`. The automated tests cover both UK clock-change days.

## Contract

The game dispatches `wp:game-complete` on `document` with:

```js
{
  version: '2',
  mode: 'precision', // or 'motion-free'
  hitScores: [300, 310, 320], // exactly three integers in 0–333
  score: 930 // sum of the three hits, in 0–999
}
```

The client submits only these fields. Optional local `runId` or `bestCombo` event fields are ignored. A score response contains `day`, `timeZone`, `resetAt`, `version`, `mode` and `highScore`. Null means nobody has submitted a score that day; zero is a valid submitted result.

This is a casual, client-reported score board. Range/sum validation and request limits do not prove someone played honestly, and CORS is not authentication. It is unsuitable for prizes or claims of cheat-proof rankings. If scoring rules change, increment the game version in the game, client and Worker together to keep unlike scores separate.

## Local checks

```sh
npm test
```

The tests use Node's built-in runner and SQLite. They check midnight and daylight-saving rollover, concurrent maximum updates, mode separation, invalid payloads and service failures, plus client hidden/unavailable states and late-response handling. They require no account or network access. These checks do not substitute for the deployed cross-browser verification above.

For interactive local Worker testing, initialise a local D1 database with `npx wrangler d1 execute wycombe-punch-daily-score --local --file=schema.sql`, then run `npm run dev`. Use a local-only origin override when testing a local webpage; preserve the production origin allowlist in `wrangler.jsonc`.
