# WYCOMBE PUNCH — REDESIGN 02
## Step up. Set the score.

The static website source for **wycombepunch.com**, with an interactive arcade cabinet, the free **Hit 999** timing game and an event-enquiry form.

**Start with `documentation/START-HERE.md`.**

## The important bit

The animated cabinet and game run locally. **Real Formspree setup is still pending**: the form endpoint is blank and enquiries remain disabled in `docs/assets/config.js`. The operator name and monitored contact/privacy email also need to be supplied. A real account, endpoint and verified test submission are required before enabling the form.

An unconfigured form says **“Enquiry prepared — not sent”** and offers a copy fallback. There is no fake booking confirmation or payment system.

## Package

- `docs/`: the authoritative static source for GitHub Pages publishing from `main` → `/docs`. Preserve `docs/CNAME` and the existing custom domain.
- `brand-assets/`: your approved original emblem, transparent master, palette and social artwork.
- `documentation/`: setup, editing, interactions and launch checks.
- `previews/`: actual Chromium-rendered screenshots and interactive local previews.
- `tests/`: reproducible local QA scripts and results.
- `build.py`: historical package generator. Do not run it for current edits; edit `docs/` directly.
- `backend/`: optional shared daily-score service and tests; deployment and connection remain pending.

No framework, build command, package install, database, external font download or animation subscription is needed by the website. A hosting service, domain, mailbox and any form provider are separate choices.

## Pages

`index.html` · `play.html` · `booking-information.html` · `privacy.html` · `brand-kit.html` · `thank-you.html` · `404.html`

## Current implementation

- The homepage cabinet responds to taps or clicks and displays its score once, on the cabinet. Copy and event cards are shorter, with the owner's price-match promise and “Get a quote in minutes” call to action.
- **Hit 999** is a one-button timing game: start, then hit the centre for 999. It supports touch, keyboard and a motion-free mode, with a best score for the current visit. The target stays 999 across layouts.
- Events include weddings and walimas, family gatherings, community events, Eid, football, schools and teams. Coverage includes Holmer Green and Hazlemere. Hire duration offers only **3–5 hours**, **Full day** and **Something else**.
- Instagram links point to [@wycombepunchmachine](https://www.instagram.com/wycombepunchmachine/). The homepage embeds the owner-selected [Raw Life Boxing video](https://www.youtube.com/watch?v=84Cwevt3H8s) using YouTube's privacy-enhanced player, with a visible source credit and no autoplay.
- The optional anonymous daily score is implemented in `docs/assets/daily-score.js` and `backend/`. Its endpoint is blank, so it is not connected. It needs a real deployed service, database, website privacy update and an end-to-end verification. See `backend/README.md`.

These are source changes and configuration status, not a claim that the latest changes or external services have been deployed. No contact details, customer reviews, booking activity or scores are fabricated.

## QA

See `tests/QA-REPORT.md` for scope and limitations. Local browser checks do not certify compliance or confirm live hosting, DNS, real enquiry delivery or physical equipment suitability.
