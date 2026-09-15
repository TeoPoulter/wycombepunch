# WYCOMBE PUNCH — REDESIGN 02
## Good company. Great competition.

A complete static website for **wycombepunch.com**, redesigned around an interactive arcade cabinet, a free skill game and a clearer event-enquiry journey.

**Start with `documentation/START-HERE.md`.**

## The important bit

The website works locally, including the animated cabinet and game. **Live enquiries are deliberately disabled** until you provide the real business/contact details, connect a submission provider and enable them in `site/assets/config.js`.

An unconfigured form says **“Enquiry prepared — not sent”** and offers a copy fallback. There is no fake booking confirmation or payment system.

## Package

- `site/`: upload the **contents** of this folder to your hosting root.
- `brand-assets/`: your approved original emblem, transparent master, palette and social artwork.
- `documentation/`: setup, editing, interactions and launch checks.
- `previews/`: actual Chromium-rendered screenshots and interactive local previews.
- `tests/`: reproducible local QA scripts and results.
- `build.py`: optional HTML-template generator used during production; not needed to host the site.

No framework, build command, package install, database, external font download or animation subscription is needed by the website. A hosting service, domain, mailbox and any form provider are separate choices.

## Pages

`index.html` · `play.html` · `booking-information.html` · `privacy.html` · `brand-kit.html` · `thank-you.html` · `404.html`

## Key changes

The homepage cabinet is now an actual interaction: tap or click to swing the bag upwards and count up a labelled sample score. The dedicated **999 Challenge** has three timing-based rounds, a best-this-visit score, keyboard/touch controls and a selectable-text fallback for sharing.

The brand and copy focus on weddings and walimas, family gatherings, community events, schools and team activities across Buckinghamshire. There is **no music, gambling, payment-to-play, prize mechanic, nightlife imagery or invented customer social proof**.

Prices stay quote-based, the machine is clearly labelled as an illustration, and the original logo is preserved.

## QA

See `tests/QA-REPORT.md` for scope and limitations. Local browser checks do not certify compliance or confirm live hosting, DNS, real enquiry delivery or physical equipment suitability.
