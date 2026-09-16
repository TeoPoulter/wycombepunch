# WYCOMBE PUNCH — REDESIGN 02
## Step up. Set the score.

The static website source for **wycombepunch.com**, with an interactive arcade cabinet, the free **Hit 999** timing game and a custom, one-question-at-a-time event enquiry with a final review.

**Start with `documentation/START-HERE.md`.**

## Public identity and contact

Use **Wycombe Punch** and **@wycombepunchmachine** for public contact. Do not place the owner’s personal name, phone number, email or personal-account asset links in the website or customer acknowledgements. No separate customer phone line or monitored domain mailbox has been created. Automatic acknowledgements remain inactive until a verified brand sender is available. The existing GitHub account and earlier public commit history still connect the project to its owner; this source cleanup is not a claim of anonymous hosting.

## The important bit

The event form is configured for the owner-created Formspree account at `https://formspree.io/f/xppwapkw`. Formspree archives submissions and sends notifications to the verified recipient set privately in its dashboard. Wycombe Punch is the owner-supplied operator name; Instagram is the public contact/privacy route. The free plan allows 50 submissions per month and a 30-day dashboard archive. No paid upgrade was selected. End-to-end acceptance and delivery must be checked after deployment.

An unconfigured form says **“Enquiry prepared — not sent”** and offers a copy fallback. There is no fake booking confirmation or payment system.

## Package

- `docs/`: the authoritative static source for GitHub Pages publishing from `main` → `/docs`. Preserve `docs/CNAME` and the existing custom domain.
- `brand-assets/`: your approved original emblem, transparent master, palette and social artwork.
- `documentation/`: setup, editing, interactions and launch checks.
- `previews/`: actual Chromium-rendered screenshots and interactive local previews.
- `tests/`: reproducible local QA scripts and results.
- `build.py`: historical package generator. Do not run it for current edits; edit `docs/` directly.
- `backend/`: optional shared daily-score service and tests; deployment and connection remain pending.
- `emails/`: prepared branded acknowledgement with Instagram-only contact.
- `enquiry-backend/`: prepared Cloudflare/Resend delivery service and tests. Not deployed or connected; the public form continues to use Formspree directly.

No framework, build command, package install, database, external font download or animation subscription is needed by the website. A hosting service, domain, mailbox and any form provider are separate choices.

## Pages

`index.html` · `play.html` · `booking-information.html` · `privacy.html` · `brand-kit.html` · `thank-you.html` · `404.html`

## Current implementation

- The homepage cabinet responds to taps or clicks and displays its score once, on the cabinet. Copy and event cards are shorter, with the owner's price-match promise and “Get a quote in minutes” call to action.
- **Hit 999** is a one-button timing game: start, then hit the centre for 999. It supports touch, mixed pointer/keyboard input without page scrolling, and a motion-free mode, with a best score for the current visit. The target stays 999 across layouts.
- Events include weddings and walimas, family gatherings, community events, Eid, football, schools and teams. Coverage includes Holmer Green and Hazlemere. Hire duration offers only **3–5 hours**, **Full day** and **Something else**. The final choice reveals the required “How long you thinking?” field; it is omitted from submissions when a preset is selected.
- Instagram links point to [@wycombepunchmachine](https://www.instagram.com/wycombepunchmachine/). The homepage hosts the supplied portrait explainer as an optimized H.264/AAC video. Its custom controls support playback, sound, seeking and an accessible fullscreen overlay. It starts muted in view; unmuting restarts the clip with sound. Fullscreen animates in and out. It pauses offscreen and respects manual pause, chosen sound, reduced-motion and data-saving preferences.
- The form advances after a committed choice or Enter, retains Back navigation, and requires explicit Send on its review. The phone answer uses an editable +44 country-code field and a separate national number, combined into the existing phone submission field.
- The favicon uses the punching bag. The cabinet logo is centred and its arrow separated from the bag; the score badge links to the game with a short transition. Town selection gets an animated confirmation.
- The ribbon asks “Who hits hardest?”. The T-Rex aside appears from 15 seconds of video playback and hides again when rewound. Exact 999 results trigger a finite confetti celebration, with a still winning treatment when motion is reduced.
- Form choices now pause visibly before a slower exit and entrance. A selected date changes the alternative to “Clear date — decide later” and explicitly labels the selected date; location confirmations have a longer fade and staggered details.
- The optional anonymous daily score is implemented in `docs/assets/daily-score.js` and `backend/`. Its endpoint is blank, so it is not connected. It needs a real deployed service, database, website privacy update and an end-to-end verification. See `backend/README.md`.

These are source changes and configuration status, not a claim that the latest changes or external services have been deployed. No contact details, customer reviews, booking activity or scores are fabricated.

## Branded email setup status

The owner approved a free service sending from the Wycombe Punch domain, including the required email-verification DNS records. A branded acknowledgement and protected delivery service are prepared. They are **not active**: account sign-in, actual provider DNS values, domain verification, a production Worker/D1/Turnstile setup and a real inbox delivery check are still required. `docs/assets/config.js` deliberately remains on the existing Formspree provider. See `enquiry-backend/README.md` for activation and recovery instructions.

## QA

See `tests/QA-2026-09-15.md` for scope and limitations. Local browser checks do not certify compliance or confirm live hosting, DNS, real enquiry delivery or physical equipment suitability.
