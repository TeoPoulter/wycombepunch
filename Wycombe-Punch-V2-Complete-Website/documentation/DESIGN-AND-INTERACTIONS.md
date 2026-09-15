# DESIGN & INTERACTIONS — REDESIGN 02

## Visual system

**Punch red `#ff2848` · Ink `#0b0b0e` · Elevated charcoal `#141419` · Chalk `#f5f3ef` · Muted silver `#a4a4af` · Quiet border `#2b2b33`.**

The supplied circular Wycombe Punch logo is preserved. The illustrated cabinet uses the same emblem rather than approximating it with generated lettering. Dark surfaces, one vivid accent, short display headlines and restrained industrial labels create the arcade identity.

Typography uses system fonts only. It therefore varies slightly with the visitor's operating system; no external font requests or font files are included. The fallback stack is defined at the top of `assets/styles.css`.

The owner-facing `brand-kit.html` includes the logo, swatches with copy buttons, type treatment and editorial principles. It has a noindex instruction and is not linked in the customer navigation; it is not a password-protected resource.

## The homepage cabinet

A bespoke inline SVG illustration with separately animated bag geometry and a three-digit, seven-segment LED display. Tapping/clicking the machine gives the bag an upwards swing, a finite settling movement and brief impact lines. The HTML score and SVG LED display count up together.

The sample scores follow a fixed demonstration sequence. They do not read camera, microphone, pressure, accelerometer or physical strength. The artwork is explicitly labelled as an illustration, and the final hire machine must be agreed separately.

Pointer tilt only applies to a fine mouse pointer and is disabled under reduced motion. Touch does not require hover. Keyboard activation uses the real button's Space/Enter behaviour.

## The 999 Challenge — play.html

- Three rounds per set, with progressively faster marker movement.
- A score from 000 to 999 based entirely on how close the stopped marker is to the centre.
- The best of the three rounds is the set result.
- Best-this-visit is held in page memory. Resetting a set keeps it; reloading the page clears it.
- No entry fee, gambling, prize, payment, audio, player account, analytics or public leaderboard.
- A round times out after 12 seconds. Switching away from the page pauses an active round without recording an attempt; the player can restart that round.
- Score sharing is a user-requested clipboard copy, with a selectable-text fallback if clipboard access is unavailable. The website never posts a score to a social platform.

Precision score: `round(999 * (1 - 2 * abs(position - 0.5)))`, clamped to 0–999.

Reduced-motion play remains a genuine game: start a static timer, estimate one second, then stop. Its score is `round(999 * (1 - abs(elapsedMs - 1000) / 1000))`, clamped to 0–999. There is no moving meter in this mode.

The game is casual client-side entertainment, not cheat-resistant competitive infrastructure or a scientific strength assessment.

## Other useful interactions

Event cards preselect the occasion in the enquiry. Town buttons populate its location and report what changed. The enquiry builder has three steps, field validation, a live summary, back navigation and an honest preview state.

FAQs use native accessible disclosure controls. The mobile menu manages focus, closes on Escape, makes the background inert and resets at the desktop breakpoint. A mobile enquiry dock moves out of the way when the form is visible.

There are scroll reveals, a moving brand ribbon, subtle hover transitions, progress indicators and finite score animations. None is required to read the site's content.

## Motion and accessibility

The header's motion button pauses cosmetic movement and changes the game to motion-free timing. The selected display preference is stored in session storage for the current tab, when available. Device-level `prefers-reduced-motion` is always respected.

Visible focus states, semantic buttons, labelled inputs, explicit statuses and clipboard fallbacks are included. Input text becomes 16px on small screens to avoid automatic iOS input zoom. No automatic music or rapidly flashing sequences are used.

Without JavaScript the main content, navigation and native FAQs remain readable. The game and enquiry builder are explicitly unavailable rather than implying a result. These measures are not a formal accessibility certification.

## Editorial choices

Use: **weddings and walimas, family gatherings, community events, schools and team activities, friendly competition, Buckinghamshire**.

Avoid: nightlife-oriented marketing, music-led promotion, gambling or prize hooks, humiliating competitors, invented reviews, fake bookings, unverified insurance and promises of current availability.

The site is faith-conscious in copy and media. The operator still needs to decide and manage acceptable real-world events and operating arrangements; the website is not a religious certificate for the wider business.
