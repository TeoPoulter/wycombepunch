# LOCAL QA REPORT — REDESIGN 02

**204 checks passed · 0 failed · 204 total.**

## Tested

Seven pages at 13 viewport widths: 320, 360, 390, 430, 580, 581, 768, 800, 801, 1024, 1280, 1440 and 1920 pixels. No page-level horizontal overflow was found at those sizes.

Static checks covered internal links/assets, duplicate IDs, H1/language/metadata, image alternative text and the absence of audio/video/iframe embeds and unwanted event-promotion wording. Primary UI colour combinations passed the tested 4.5:1 contrast threshold; this is not a full-page contrast audit.

Browser interaction checks covered the bag swing and settling, synchronised demonstration scores, motion preference, coverage and event preselection, all enquiry steps, whitespace/email/date validation, optional dates, zero preview submissions, clipboard-denied fallbacks, native FAQ disclosure, mobile navigation and focus recovery.

Game checks covered scoring boundaries, marker movement, three-round completion, best-score calculation, reset, keyboard controls, reduced-motion timing, device preference and timeout. No JavaScript runtime errors were observed during the suite. No-JavaScript checks confirmed readable content, navigation and genuinely disabled enquiry controls.

## Environment and limits

The environment's Chromium policy blocks URL navigation. Tests rendered **the actual local HTML/CSS/JavaScript with local assets inlined into about:blank**, without changing browser policies or making network requests. This tests layout and browser interactions, not a real hosting deployment.

A Chromium viewport is not the same as a physical iPhone, Android device or Safari engine. A device-specific manual pass is still recommended.

**Not verified:** DNS/SSL, actual Netlify processing, real inbox receipt, provider account setup/billing, live HTTP security headers, live form success/error delivery, a registered Instagram account, physical machine operation, transport, insurance, legal or religious compliance. Enquiries remain safely disabled by default.

`qa-results.json` contains the individual checks. The scripts are local QA tools and are not loaded by the website.
