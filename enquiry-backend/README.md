# Wycombe Punch enquiry receipts

**Prepared and tested locally; deployment and real email delivery must be verified separately.** This is a separate Cloudflare Worker and D1 database from `backend/` (the optional daily game score). The website stays on GitHub Pages. Formspree remains the owner's enquiry inbox. Resend sends the fixed branded acknowledgement to the email address supplied by the visitor.

## What it does

1. Accepts the existing form fields at `POST /enquiry`, checks lengths/values, verifies a Turnstile token, and applies a Cloudflare rate-limit binding.
2. Atomically claims the browser's UUID in D1 **before** forwarding the enquiry to `https://formspree.io/f/xppwapkw`. `_wp_request_id` is added to the Formspree record for reconciliation.
3. Only a successful Formspree HTTP response with JSON `ok: true` becomes an accepted enquiry. That transition also creates the durable receipt queue in the same D1 row.
4. Returns lead success independently of email delivery. `waitUntil` tries the receipt immediately; a five-minute cron retries queued receipts.
5. Uses Resend's `Idempotency-Key` with the exact stored email body. Retries are limited to eight attempts and 23 hours after acceptance, inside Resend's 24-hour deduplication period.

There is deliberately no automatic retry of a Formspree request whose result is ambiguous. Formspree does not supply an idempotency contract here; a lost response could mean the enquiry was already saved. Pending/uncertain claims cannot forward again under the same key. An interrupted request becomes uncertain after two minutes. This trades automatic recovery for avoiding duplicate customer enquiries.

The default sender is `Wycombe Punch <no-reply@wycombepunch.com>`. **Verifying a sending domain does not create a receiving mailbox.** The email directs customers to the Wycombe Punch Instagram account. It contains no personal phone number, personal name or personal email. An optional `REPLY_TO_EMAIL` secret may be added only for an approved, monitored Wycombe Punch domain address. Other domains are rejected. No private owner email is committed or required.

## Required setup (free plans; no paid upgrade is authorised by this directory)

Use the owner's Cloudflare and Resend accounts. Confirm current free-plan allowances in those accounts before enabling. Existing Formspree limits still apply. No allowance is unlimited; a free quota failure is handled as a real failure, not silently bypassed.

From `enquiry-backend/`:

```sh
npm install
npm test
npx wrangler login
npx wrangler d1 create wycombe-punch-enquiries
```

- Replace only `REPLACE_WITH_CREATED_D1_DATABASE_ID` in `wrangler.jsonc` with the returned D1 ID.
- Keep the database binding `DB`. Keep it separate from the game's database.
- Ensure rate-limit namespace ID `1609202602` is unique for this account. It allows 10 requests per minute per network address, including same-key status retries. The binding is approximate per Cloudflare location, not a worldwide strict anti-abuse guarantee.
- Create a Turnstile widget restricted to `wycombepunch.com` and `www.wycombepunch.com`. Frontend action must be `enquiry`. Use a production widget, not the public testing keys. Widget sitekey is public; secret stays server-side.
- In Resend verify the sending domain using only the records Resend provides. Preserve the existing website A/CNAME records, HTTPS and unrelated DNS. Do not add or replace a root MX record to create a mailbox: this setup sends only. Configure the actual required sending records carefully in the existing DNS provider.
- Create a Resend API key scoped to sending for the verified domain if the provider offers that restriction. Enter secrets through Wrangler's interactive secret prompt; never put them in JS, HTML, committed config, command arguments or frontend storage:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
# Optional, only after the owner approves a monitored reply address:
# npx wrangler secret put REPLY_TO_EMAIL
npx wrangler d1 execute wycombe-punch-enquiries --remote --file=schema.sql
npx wrangler deploy
```

`FROM_EMAIL` is the non-secret sender variable already set in `wrangler.jsonc`. Do not enable the frontend until Resend confirms this domain can send, the real production Turnstile keys are configured, D1 schema is applied, and the Worker has deployed successfully.

Use the returned `https://…workers.dev/enquiry` address in the client config. This does not require changing the website's hosting or nameservers. Client Content Security Policy, if enforced, must permit this Worker in `connect-src`, `https://challenges.cloudflare.com` for the Turnstile script/frame and any requirements documented by Cloudflare. The privacy page includes conditional Cloudflare/Turnstile and Resend notices that become visible only with the worker provider enabled. Review these against the final configuration. Bump the app/config asset query versions on every HTML page when enabling, so old cached routing cannot reject the new provider. The client adapter is included before app.js on the homepage; its challenge container must remain outside the disabled fieldset and be shown during verification. Allow 180 seconds overall for script loading, an interactive check and the bounded POST.

## Client contract

Use `application/x-www-form-urlencoded`, not multipart or arbitrary JSON:

```text
POST https://DEPLOYED_WORKER.workers.dev/enquiry
Origin: https://wycombepunch.com
Content-Type: application/x-www-form-urlencoded
Idempotency-Key: <crypto.randomUUID() UUIDv4>
```

Allowed body keys:

- `form-name` must equal `wycombe-punch-enquiry`.
- `_gotcha` must be empty or absent.
- `event-type`: one of `Weddings & walimas`, `Family gathering`, `Community event`, `Eid celebration`, `Football event`, `School or team event`, `Something else`.
- `event-date`: valid future/today `YYYY-MM-DD`, or blank when undecided. Server uses Europe/London for a new request. An accepted same-key replay remains recoverable after its date passes.
- `venue`: required, at most 300 characters.
- `duration`: exactly `3–5 hours`, `Full day`, or `Something else`.
- `duration-detail`: required when Something else, at most 200 characters; ignored for standard durations.
- `message`: optional, at most 1,500 characters, line breaks allowed.
- `name`: required, at most 120 characters.
- `phone`: combined international code, space, national digits; e.g. `+44 7700900123`. Total 7–15 digits.
- `email`: one required email address, at most 254 characters.
- `cf-turnstile-response`: the fresh widget token (max 2,048 characters). Token is excluded from the canonical payload hash and is never forwarded to Formspree or stored.

Unknown/duplicate fields are rejected. Body limit is 16 KiB. A new request checks the production origin allowlist, Turnstile success, matching hostname and action, plus rate limiting. CORS alone is not authentication.

Keep one UUID with an unchanged canonical enquiry across network retries. Refreshing the Turnstile token does not require a new UUID. Do not silently create a new key after an ambiguous result, even if the customer edits the form: make the unresolved prior attempt clear and direct them to contact the operator. A changed body with a claimed key is a conflict. Persisting a pending key safely across a page refresh belongs to the frontend; do not expose secrets in that storage.

All response bodies are JSON and use `Cache-Control: no-store`:

| HTTP | `code` or success | Client action |
| --- | --- | --- |
| 200 | `{accepted:true, requestId, receipt:'queued'\|'sent'\|'unavailable'}` | Show enquiry success. `requestId` is the exact submitted UUID. Receipt state does not change lead success. |
| 409 | `enquiry_pending` | Same-key status retry after `Retry-After: 3`; never forward under a new key automatically. |
| 409 | `manual_check_required` | Outcome uncertain. Keep reference, stop retries and ask owner to check Formspree. |
| 409 | `idempotency_conflict` | A key was reused with changed answers. Stop; do not discard the unresolved reference. |
| 422 | `upstream_rejected`, `retryWithNewKey:true` | Explicit Formspree rejection. Preserve answers; only an explicit later user retry may use a new UUID and new challenge. |
| 403 | `challenge_failed` | Reset the widget and retry the same UUID with a fresh token. |
| 503 | `challenge_unavailable` | Challenge service could not be checked; preserve answers and key. |
| 429 | `rate_limited` | Wait at least 60 seconds; keep same key. |
| 400 | `invalid_payload` / `invalid_idempotency_key` | Correct the request before sending. No lead was forwarded. |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` | Correct the request. |
| 503 | `service_unavailable` | Preserve key and answers. Retry with the same key; no automatic alternate route. |

There is no public admin, list, email-trigger or GET status endpoint. Reposting unchanged answers with the same UUID recovers the stored result without resending to Formspree or replaying the consumed challenge.

## Receipt content and retries

The approved sources are `../emails/enquiry-confirmation.html` and `.txt`. Run `npm run sync-template` after an approved edit and review the generated `receipt-template.mjs`. No visitor message, arbitrary subject, link, phone number or HTML is interpolated into the receipt. Only the single validated recipient comes from the form.

Each claimed row snapshots the complete Resend body, including fixed HTML/text, sender and optional reply address. Retries use that same body even if a later deployment changes the template. A one-minute lease prevents concurrent cron/request receipt jobs from sending together; Resend's idempotency key covers a crash after Resend accepts but before D1 saves the result. Permanent provider rejection and exhausted retries become visible dead letters. `sent` means Resend accepted the API request, **not proof of inbox arrival**. Bounces and delivery results should be checked in Resend.

## Operator checks and recovery

Use the owner's Cloudflare dashboard/D1 console or Wrangler, not a public website route. Check failures regularly; there is no separate proactive alerting service in this version:

```sql
SELECT * FROM delivery_issues ORDER BY updated_at DESC;
SELECT state, receipt_state, COUNT(*) AS total FROM enquiries GROUP BY state, receipt_state;
```

For `uncertain`, search Formspree submissions for `_wp_request_id`. Do not resubmit the enquiry merely because its response was lost. The original event details remain in Formspree if it accepted; they are not copied into D1.

- If Formspree confirms the record exists, the owner can mark that exact D1 row accepted and queue its stored receipt. It has never attempted a receipt, so set `expires_at` to now + 23 hours, `next_attempt_at` to now, `receipt_state='queued'`, `state='accepted'`, `last_error=NULL` only for the reconciled request. Use millisecond timestamps. Do not do this without checking the matching Formspree record.
- If the provider definitively confirms no enquiry was stored, mark the exact uncertain row rejected and remove `receipt_body`; the customer may then make an explicit new-key attempt. Absence from an unavailable dashboard is not definitive evidence.
- For a receipt marked `dead`, check Resend for the stable key `wp-enquiry/<request_id>` before deciding to send anything. Never automatically reopen or retry an old ambiguous send beyond the 23-hour window; Resend only deduplicates for 24 hours. A later manual send can duplicate a previously accepted email.

## Retention and secrets

D1 stores request UUID, a hash of the canonical enquiry, timestamps, outcome/attempt metadata and the receipt body containing the recipient email. It does **not** store the customer's full event details, name, telephone, IP address or Turnstile token. Formspree separately stores the full enquiry under its plan/retention policy.

The cron removes the receipt body (and therefore recipient address) 24 hours after Resend acceptance. Metadata/hash tombstones remain for 30 days so old same-key retries do not duplicate enquiries. Uncertain/failed receipt records retain the minimum recovery data for at most 30 days, then the whole row is deleted. Idempotency protection is therefore bounded to 30 days; the client must never retry a month-old unresolved submission automatically. D1 provider backups may have their own retention. Resend and Formspree separately process/store data under their own policies.

Runtime logs are disabled in the checked-in configuration. The Worker never logs payloads, tokens or provider response bodies. Private keys live only in Worker secrets. Rate limiting temporarily uses the connecting network address; it is not stored in application D1.

## Verification

`npm test` uses Node 24's built-in test runner and real in-memory SQLite with fake fetches. It sends no external submissions or emails. Tests cover concurrent claims, accepted replay, payload conflict, uncertain forwarding, explicit rejection, Turnstile action/hostname failures, rate limiting, validation, durable retry, expired retry windows, receipt idempotency, retention, and fixed branded content.

After deployment, test from the real site with an owner-approved, clearly marked enquiry and real Turnstile token. Verify all of: Formspree saved the lead exactly once; receipt sent to the form's submitted email; Resend accepted it; actual recipient inbox received it; links and design render correctly. Refresh/retry the same request key and verify no second Formspree record or receipt. Do not label email delivery live merely because configuration exists.

Primary service references:

- [Resend idempotency keys and 24-hour retention](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Turnstile mandatory server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
