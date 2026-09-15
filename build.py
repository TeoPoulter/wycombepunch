"""Historical package generator, retained for reference.
The live GitHub Pages source is docs/. Edit those static files directly.
"""
if __name__ == '__main__':
    raise SystemExit('The live source is docs/. This historical generator is retired; edit docs/ directly.')

from pathlib import Path
import json, html
ROOT = Path(__file__).parent
SITE = ROOT / 'site'
A = SITE / 'assets'

def write(path, text):
    p = SITE/path; p.parent.mkdir(parents=True, exist_ok=True); p.write_text((text.replace('<br>', '<br> ') if str(path).endswith('.html') else text).strip()+'\n', encoding='utf-8')

ICONS = {
'arrow':'<path d="M5 12h14M12 5l7 7-7 7"/>',
'arrow-up':'<path d="M6 18 18 6M6 6h12v12"/>',
'chevron':'<path d="m9 5 7 7-7 7"/>',
'plus':'<path d="M12 5v14M5 12h14"/>',
'check':'<path d="m5 12 4 4L19 6"/>',
'pin':'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
'play':'<path d="m9 5 11 7-11 7V5Z"/>',
'spark':'<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
'heart':'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
'people':'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5.2"/>',
'flag':'<path d="M4 22V3m0 1c6-5 10 5 16 0v11c-6 5-10-5-16 0"/>',
'trophy':'<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v6m-5 2h10m-8-2h6"/>',
'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 5h2m4 0h2"/>',
'truck':'<path d="M1 4h14v13H1V4Zm14 5h4l4 4v4h-8M1 17h2m6 0h6"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>',
'bolt':'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
'copy':'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
'instagram':'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
'mail':'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 8L22 5"/>',
'pause':'<path d="M8 4v16M16 4v16"/>',
'restart':'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
'sound-off':'<path d="m11 5-6 4H2v6h3l6 4V5Zm6 4 5 6m0-6-5 6"/>',
'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
'share':'<path d="M12 16V2M7 7l5-5 5 5M5 13H3v9h18v-9h-2"/>',
'shield':'<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
'menu':'<path d="M3 8h18M3 16h18"/>'
}
def icon(name, cls=''):
    return f'<svg class="icon {cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{ICONS[name]}</svg>'

def led(num='000'):
    shapes={
      'a':'M3 0h10l2 2-2 2H3L1 2Z', 'b':'m16 3 2 2v9l-2 2-2-2V5Z',
      'c':'m16 19 2 2v9l-2 2-2-2v-9Z', 'd':'M3 32h10l2 2-2 2H3l-2-2Z',
      'e':'m0 19 2 2v9l-2 2-2-2v-9Z','f':'m0 3 2 2v9l-2 2-2-2V5Z',
      'g':'M3 16h10l2 2-2 2H3l-2-2Z'}
    segmap=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg']
    return '<g data-led-display transform="translate(298 237)">' + ''.join(
      f'<g data-digit="{i}" transform="translate({i*25} 0)">' + ''.join(f'<path data-segment="{s}" class="led-segment {"lit" if s in segmap[int(n)] else ""}" d="{d}"/>' for s,d in shapes.items()) + '</g>' for i,n in enumerate(num)) + '</g>'

def machine(uid='hero', num='000'):
    return f'''<svg class="machine-svg" data-machine-svg viewBox="0 0 560 650" aria-hidden="true" focusable="false">
<defs>
 <linearGradient id="{uid}-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#323238"/><stop offset=".45" stop-color="#151519"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient>
 <linearGradient id="{uid}-side"><stop stop-color="#840919"/><stop offset=".8" stop-color="#ed1635"/><stop offset="1" stop-color="#ff3c52"/></linearGradient>
 <linearGradient id="{uid}-bag" x1="0" y1=".3" x2="1" y2=".5"><stop stop-color="#720b18"/><stop offset=".27" stop-color="#e21830"/><stop offset=".54" stop-color="#ff344b"/><stop offset="1" stop-color="#a30b21"/></linearGradient>
 <linearGradient id="{uid}-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#57575e"/><stop offset="1" stop-color="#17171c"/></linearGradient>
 <radialGradient id="{uid}-floor"><stop stop-color="#ee203d" stop-opacity=".2"/><stop offset=".7" stop-color="#ee203d" stop-opacity=".04"/><stop offset="1" stop-color="#ee203d" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="290" cy="591" rx="235" ry="55" fill="url(#{uid}-floor)"/>
<ellipse cx="290" cy="591" rx="177" ry="35" fill="none" stroke="#ff2848" stroke-opacity=".15"/>
<ellipse cx="290" cy="593" rx="138" ry="18" fill="#050506" opacity=".7"/>
<path d="m193 571 211-23 27 27-1 18-227 27-23-25Z" fill="#1d1d22" stroke="#4c4c54"/>
<path d="m203 603 224-27 3 17-227 27Z" fill="#09090c"/>
<path d="m225 199 169-21-10 392-171 21Z" fill="url(#{uid}-face)" stroke="#53535c" stroke-width="1.6"/>
<path d="m394 178 45-24-9 393-46 23Z" fill="url(#{uid}-side)"/>
<path d="m407 201 16-9-7 335-15 12Z" fill="#510818" opacity=".5"/>
<path d="m414 436 7-4-2 76-7 5Z" fill="#ff7280" opacity=".65"/>
<path d="m219 376-2 205M389 324l-9 239" stroke="#fa2443" stroke-width="4"/>
<path d="m284 221 91-12-1 96-91 12Z" fill="#060608" stroke="#4b4b54"/>
<text x="329" y="230" fill="#a0a0ac" font-size="6" font-family="Arial,sans-serif" letter-spacing="1.4" text-anchor="middle">YOUR SCORE</text>
{led(num)}
<text x="329" y="299" fill="#8f8f9c" font-size="5.4" font-family="Arial,sans-serif" letter-spacing="1" text-anchor="middle">A LITTLE FRIENDLY COMPETITION</text>
<path d="m306 326 65-7v17l-65 7Z" fill="#111115" stroke="#4a4a53"/>
<circle cx="319" cy="333" r="4" fill="#ff2848"/>
<path d="m333 327 25-3v7l-25 3Z" fill="#030304" stroke="#44444e"/>
<path d="m228 365 146-17-3 166-147 18Z" fill="#111114" stroke="#313138"/>
<image href="assets/logo-small.webp" x="245" y="376" width="106" height="106"/>
<path d="m237 537 116-14m-116 20 116-14m-116 20 116-14" stroke="#42424b" stroke-width="2"/>
<rect x="234" y="566" width="11" height="7" fill="#2c2c33" transform="rotate(-7 234 566)"/>
<circle cx="243" cy="559" r="1.8" fill="#81818b"/>
<path d="m143 89 48-26 204-21 48 29-57-4Z" fill="url(#{uid}-metal)" stroke="#48484f"/>
<path d="m386 67 57 24 11 75-48 23Z" fill="url(#{uid}-side)"/>
<path d="m143 89 243-22 20 122-245 27Z" fill="url(#{uid}-face)" stroke="#68686f" stroke-width="2"/>
<path d="m152 98 224-20 17 101-224 26Z" fill="#0c0c10" stroke="#fa2846" stroke-width="2.8"/>
<path d="m164 110 67-6m87-8 46-4m-192 96 61-7m88-11 54-6" stroke="#ff2f49" stroke-width="5"/>
<image href="assets/logo-small.webp" x="234" y="86" width="82" height="82"/>
<path d="m161 216 246-27-29 23-189 23Z" fill="#07070a" stroke="#38383e"/>
<path d="m205 219 45-6v10l-43 6Z" fill="#ff2645" opacity=".25"/>
<g class="bag-assembly">
 <path d="m222 212 14-1v23l-14 2Z" fill="url(#{uid}-metal)" stroke="#62626c"/>
 <path d="m217 235 24-2 5 32-33 2Z" fill="#871125"/>
 <path d="m215 255 29-2c3 27 22 43 22 66 0 32-19 47-39 47-23 0-41-17-39-45 1-24 21-44 27-66Z" fill="url(#{uid}-bag)" stroke="#ff5469" stroke-opacity=".4"/>
 <path d="m232 264c-2 30 18 53 11 78" fill="none" stroke="#ff8492" stroke-opacity=".55" stroke-width="1.8"/>
 <path d="m213 280c-13 24-18 48-7 63" fill="none" stroke="#620819" stroke-width="3" opacity=".55"/>
 <path d="m216 244 25-2m-26 8 28-2" stroke="#f75068" stroke-opacity=".5"/>
 <path d="m236 322-7 8 5 6-9 11" fill="none" stroke="#ffd3d9" stroke-width="2" opacity=".7"/>
</g>
<g class="impact-rays" stroke="#ff405a" stroke-width="3" stroke-linecap="round">
 <path d="m169 285-22-9m111 9 20-12m-70 98-8 21m-20-45-23 11m91-7 20 10m-27-99 6-15"/>
</g>
<text x="305" y="606" text-anchor="middle" fill="#777782" font-family="Arial,sans-serif" font-size="6" letter-spacing="3">WYCOMBE PUNCH / WP—01</text>
</svg>'''


def head(title, desc, path='index.html', noindex=False, game=False):
    canonical='https://wycombepunch.com/' + ('' if path=='index.html' else path)
    return f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)} | Wycombe Punch</title>
<meta name="description" content="{html.escape(desc)}"><meta name="theme-color" content="#0b0b0e">
{'<meta name="robots" content="noindex,follow">' if noindex else ''}
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Wycombe Punch"><meta property="og:locale" content="en_GB">
<meta property="og:title" content="{html.escape(title)} | Wycombe Punch"><meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canonical}"><meta property="og:image" content="https://wycombepunch.com/assets/social-share.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://wycombepunch.com/assets/social-share.jpg">
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" href="assets/favicon-32.png" type="image/png" sizes="32x32"><link rel="apple-touch-icon" href="assets/apple-touch-icon.png"><link rel="manifest" href="site.webmanifest">
<link rel="stylesheet" href="assets/styles.css"><script src="assets/config.js" defer></script><script src="assets/app.js" defer></script>{'<script src="assets/game.js" defer></script>' if game else ''}
</head>'''

def header(home=False, game=False):
    h='' if home else 'index.html'
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<div class="topline"><div class="wrap topline-inner"><span>{icon('pin')} HIGH WYCOMBE ROOTS. BUCKINGHAMSHIRE REACH.</span><span class="topline-right">ONE MACHINE. EVERYONE’S GAME.</span></div></div>
<header class="site-header" id="site-header"><div class="wrap header-inner">
<a class="brand" href="index.html" aria-label="Wycombe Punch home"><img src="assets/logo-small.webp" width="54" height="54" alt=""><span>WYCOMBE<strong>PUNCH<span class="red">.</span></strong></span></a>
<nav class="main-nav" id="main-nav" aria-label="Main navigation"><a href="{h}#experience">The experience</a><a href="{h}#occasions">Your event</a><a href="{h}#coverage">Our area</a><a href="play.html" class="nav-play" {'aria-current="page"' if game else ''}>{icon('play')} Play the 999 challenge</a><a class="nav-mobile-cta" href="{h}#enquire">Plan your event {icon('arrow-up')}</a></nav>
<div class="header-actions"><button type="button" class="motion-toggle" data-motion-toggle aria-pressed="false" aria-label="Reduce animation"><span data-motion-icon>{icon('pause')}</span><span data-motion-label>Motion on</span></button><a class="button button-small header-cta" href="{h}#enquire">Get a quote {icon('arrow-up')}</a><button type="button" class="menu-toggle" aria-controls="main-nav" aria-expanded="false" aria-label="Open navigation">{icon('menu')}</button></div>
</div><div class="scroll-progress" aria-hidden="true"></div></header>'''

def footer(home=False):
    h='' if home else 'index.html'
    return f'''<footer class="site-footer"><div class="wrap"><div class="footer-top"><a class="brand" href="index.html" aria-label="Wycombe Punch home"><img src="assets/logo-small.webp" width="54" height="54" alt=""><span>WYCOMBE<strong>PUNCH<span class="red">.</span></strong></span></a><p>Good company.<br>Great competition.</p><div class="footer-links"><a href="{h}#enquire">Plan your event {icon('arrow-up')}</a><a href="play.html">Play the 999 challenge {icon('arrow-up')}</a><a data-instagram hidden target="_blank" rel="noopener noreferrer">{icon('instagram')} Instagram</a><a data-contact-email hidden>{icon('mail')} Email us</a></div></div><div class="footer-wordmark" aria-hidden="true">WYCOMBE<span>PUNCH.</span></div><div class="footer-bottom"><p>© <span data-year>2026</span> Wycombe Punch. Buckinghamshire, UK.</p><nav aria-label="Legal information"><a href="booking-information.html">Booking information</a><a href="privacy.html">Privacy</a></nav></div></div></footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>'''

faqs=[
('Where do you cover?', 'We’re based in High Wycombe and welcome enquiries across Buckinghamshire, including Marlow, Beaconsfield, Amersham, Chesham, Aylesbury, Gerrards Cross, Buckingham and Milton Keynes. Delivery and collection are quoted for your exact venue.'),
('How much is private hire?', 'Tell us your date, venue and hire duration and we’ll provide a written quote. It will set out the hire charge, transport, setup, collection and any agreed extras. No payment is taken through this website.'),
('Will guests need coins or a card?', 'For private hire, our proposed setup is free-play: the organiser pays for the agreed hire period rather than guests paying per punch. The final machine and package are confirmed in your quote.'),
('What does the venue need?', 'We’ll confirm the machine’s dimensions, power supply, floor space and clearances before a booking is agreed. Please tell us about steps, lifts, doorways and vehicle access. Do not assume every machine can be carried upstairs.'),
('Is it suitable for younger guests?', 'Suitable ages and safe use depend on the particular machine and manufacturer’s instructions. These, and the supervision arrangements, must be agreed before booking. A responsible adult must oversee use; the activity is not a childcare service.'),
('Can it be used outside?', 'Outdoor use is only considered when the selected machine, weather protection, safe power supply and venue arrangements allow it. We’ll agree this beforehand; please don’t assume an uncovered outdoor setup is possible.'),
('Is the online game a real strength test?', 'No. The homepage machine is an animated demonstration. The 999 Challenge is a free timing game, not a measurement of physical strength. There are no entry fees, paid upgrades, prizes or public leaderboards.'),
('When is my booking confirmed?', 'An enquiry does not reserve a date. A booking is only confirmed once availability, the machine, venue requirements, the full price and written hire terms have been agreed. Any deposit and cancellation conditions will be set out beforehand.')
]
faq_html=''.join(f'<details class="faq"><summary><span>{q}</span>{icon("plus")}</summary><div class="faq-answer"><p>{a}</p></div></details>' for q,a in faqs)

occasion_data=[
('01','heart','Weddings & walimas','A new kind of<br>friendly rivalry.','A memorable addition to your celebration. Let family and friends enjoy a little good-natured competition between the conversations.','Weddings & walimas','FAMILY AGAINST FAMILY. ALL IN GOOD SPIRIT.'),
('02','people','Family gatherings','Everyone has<br>a challenger.','Bring your people together for a simple score challenge. The fun is in taking turns, encouraging one another and seeing who surprises the group.','Family gathering','GOOD COMPANY. A SCORE TO CHASE.'),
('03','flag','Community events','Bring your<br>community together.','An interactive focal point for community days, youth programmes and local events, with suitable ages and supervision agreed in advance.','Community event','LOCAL CONNECTIONS. FRIENDLY COMPETITION.'),
('04','trophy','Schools & teams','A little<br>team spirit.','Add a score-based challenge to a school event or team activity. We’ll discuss participant suitability, venue requirements and a safe setup.','School or team event','TAKE YOUR TURN. CHEER EACH OTHER ON.')
]
occasions_html=''.join(f'''<article class="occasion-card reveal" style="--delay:{i*70}ms"><div class="occasion-card-top"><span class="micro">{num} / YOUR OCCASION</span><span class="occasion-icon">{icon(ic)}</span></div><p class="occasion-label">{title}</p><h3>{headline}</h3><p>{copy}</p><button class="text-link" type="button" data-event="{value}">Plan this event {icon('arrow-up')}</button><div class="occasion-bottom micro">{end}</div></article>''' for i,(num,ic,title,headline,copy,value,end) in enumerate(occasion_data))

form_html=f'''
<section class="enquiry-section section" id="enquire" aria-labelledby="enquiry-heading"><div class="wrap enquiry-layout">
<div class="enquiry-intro reveal"><p class="eyebrow"><span></span> LET’S MAKE IT HAPPEN</p><h2 id="enquiry-heading">YOUR EVENT.<br><em>OUR NEXT<br>HIGH SCORE.</em></h2><p>Give us a few details. We’ll work out the machine, timings and transport with you.</p><div class="quote-note">{icon('info')}<p><strong>A clear quote. No guesswork.</strong><br>Availability, delivery and your final package are confirmed before you commit.</p></div><div data-price-guide hidden class="price-guide">Guide hire from <strong>£<span data-price>200</span></strong><small>Final price and delivery confirmed in writing.</small></div><div class="enquiry-contact"><a data-instagram hidden target="_blank" rel="noopener noreferrer">{icon('instagram')} Message us on Instagram {icon('arrow-up')}</a><a data-contact-email hidden>{icon('mail')} Send an email {icon('arrow-up')}</a></div></div>
<div class="enquiry-form-card reveal"><div class="form-top"><span class="micro">BUILD YOUR EVENT ENQUIRY</span><span class="form-step-label" id="step-indicator">01 / 03</span></div><div class="form-progress" aria-hidden="true"><span></span></div>
<p class="preview-notice" id="preview-notice">Website preview: you can prepare and copy an enquiry, but this form is not connected to an inbox yet.</p>
<noscript><p class="preview-notice">JavaScript is needed for this enquiry builder. Enquiries are disabled in this preview. Please use an established contact method.</p></noscript>
<form id="enquiry-form" name="wycombe-punch-enquiry" method="POST" action="thank-you.html" data-netlify="true" netlify-honeypot="bot-field" novalidate>
<input type="hidden" name="form-name" value="wycombe-punch-enquiry"><p class="honeypot" aria-hidden="true"><label>Leave this field empty<input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
<fieldset id="enquiry-fields" disabled><legend class="sr-only">Event enquiry</legend>
<div class="form-step" data-step="0"><h3 tabindex="-1">First, the occasion.</h3><p class="form-hint">Choose what you’re planning.</p><label for="event-type">Event type <span aria-hidden="true">*</span></label><select id="event-type" name="event-type" required><option value="">Select your event</option><option>Weddings &amp; walimas</option><option>Family gathering</option><option>Community event</option><option>School or team event</option><option>Something else</option></select>
<label for="event-date">Event date <span class="optional">(optional)</span></label><input id="event-date" name="event-date" type="date"><p class="field-note">No date yet? That’s absolutely fine.</p>
<label for="duration">Hire duration</label><select id="duration" name="duration"><option value="Not sure yet">Not sure yet</option><option>Up to 3 hours</option><option>3–5 hours</option><option>Full day</option><option>Something else</option></select></div>
<div class="form-step" data-step="1" hidden><h3 tabindex="-1">Where’s it happening?</h3><p class="form-hint">This helps us work out the setup and transport.</p><label for="venue">Venue, town or postcode <span aria-hidden="true">*</span></label><input id="venue" name="venue" type="text" placeholder="e.g. a venue in High Wycombe" maxlength="180" required autocomplete="off">
<label for="message">Anything else we should know? <span class="optional">(optional)</span></label><textarea id="message" name="message" rows="4" maxlength="1500" placeholder="Guest numbers, access, steps, indoors or outdoors…"></textarea><p class="field-note message-count"><span>Please do not include sensitive personal information.</span><span><span id="message-count">0</span>/1500</span></p></div>
<div class="form-step" data-step="2" hidden><h3 tabindex="-1">Let’s stay in touch.</h3><p class="form-hint">Your details are used to respond to this enquiry.</p><div class="field-row"><div><label for="name">Your name <span aria-hidden="true">*</span></label><input id="name" name="name" type="text" required maxlength="100" autocomplete="name"></div><div><label for="email">Email address <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email"></div></div><label for="phone">Phone number <span class="optional">(optional)</span></label><input id="phone" name="phone" type="tel" maxlength="40" autocomplete="tel">
<div class="enquiry-summary"><span class="micro">YOUR GAME PLAN</span><dl><div><dt>Event</dt><dd data-summary="event">Not selected</dd></div><div><dt>When</dt><dd data-summary="date">To be confirmed</dd></div><div><dt>Where</dt><dd data-summary="venue">To be confirmed</dd></div><div><dt>Duration</dt><dd data-summary="duration">Not sure yet</dd></div></dl></div>
<p class="form-privacy">Read our <a href="privacy.html">privacy information</a>. This is an enquiry, not a confirmed booking. No payment is taken.</p></div>
<div class="form-actions"><button type="button" class="button button-ghost" id="form-back" hidden>Back</button><button type="button" class="button" id="form-next">Next: the details {icon('arrow')}</button><button type="submit" class="button" id="submit-enquiry" hidden><span id="submit-label">Prepare my enquiry</span>{icon('arrow-up')}</button></div>
</fieldset></form>
<div class="form-result" id="form-result" role="status" tabindex="-1" hidden><h3 id="form-result-title"></h3><p id="form-result-text"></p><button type="button" class="button button-small button-outline" id="copy-enquiry">{icon('copy')} Copy enquiry details</button><label for="copy-fallback" class="sr-only">Enquiry text to copy</label><textarea id="copy-fallback" readonly rows="9" hidden></textarea></div>
</div></div></section>'''

home = head('Boxing machine hire across Buckinghamshire', 'Good company. Great competition. Arcade boxing machine hire for weddings, walimas, family gatherings and community events across Buckinghamshire.') + f'''
<body class="home-page">{header(True)}<main id="main">
<section class="hero wrap" aria-labelledby="hero-heading">
<div class="hero-copy"><p class="eyebrow"><span></span> BOXING MACHINE HIRE · BUCKINGHAMSHIRE</p><h1 id="hero-heading">BRING YOUR<br><em>COMPETITIVE</em><br>SIDE<span class="red">.</span></h1><p class="hero-description">Good company. A little friendly rivalry.<br>Bring the arcade to your next gathering.</p><div class="hero-actions"><a class="button" href="#enquire">Plan your event {icon('arrow-up')}</a><a class="text-link" href="play.html"><span class="round-play">{icon('play')}</span> Try the 999 challenge</a></div><div class="hero-note"><span class="mini-line"></span> WEDDINGS &amp; WALIMAS · FAMILY · COMMUNITY</div></div>
<div class="hero-stage" data-tilt-stage><div class="stage-top"><span class="micro"><span class="status-dot"></span> YOUR FIRST GO IS RIGHT HERE</span><span class="micro">WP—01</span></div><div class="stage-ghost" aria-hidden="true">999</div><div class="stage-grid" aria-hidden="true"></div><div class="machine-tilt"><button class="machine-touch" id="hero-machine" type="button" aria-label="Hit the virtual boxing bag and reveal a demonstration score" aria-describedby="hero-demo-note" disabled>{machine('hero')}</button></div><div class="floating-score" aria-hidden="true"><span class="micro">DEMO SCORE</span><strong id="hero-score">000</strong><span class="score-caption">Your turn.</span></div><div class="hit-prompt" aria-hidden="true"><span class="tap-circle">{icon('bolt')}</span><span>GO ON.<br><strong>TAP THE BAG.</strong></span><svg viewBox="0 0 75 50" fill="none"><path d="M6 7c44-17 55 6 49 32m-10-9 10 9 12-8" stroke="currentColor" stroke-width="1.5"/></svg></div><p class="stage-caption" id="hero-demo-note">Interactive illustration. Sample scores, not a strength test.<br>Final hire machine confirmed with your quote.</p><p class="sr-only" role="status" id="hero-live"></p><noscript><p class="stage-caption">Enable JavaScript to try the interactive bag.</p></noscript></div>
</section>
<div class="ribbon" aria-label="Good company. Great competition. Across Buckinghamshire."><div class="ribbon-track" aria-hidden="true">{''.join(f'<span>GOOD COMPANY.</span>{icon("spark")}<span>GREAT COMPETITION.</span>{icon("spark")}<span>ACROSS BUCKINGHAMSHIRE.</span>{icon("spark")}' for _ in range(3))}</div></div>
<section class="section experience-section" id="experience" aria-labelledby="experience-heading"><div class="wrap"><div class="section-heading"><div class="reveal"><p class="eyebrow"><span></span> SIMPLE IDEA. BIG REACTIONS.</p><h2 id="experience-heading">ONE MACHINE.<br><em>EVERYONE’S GAME.</em></h2></div><p class="section-intro reveal">One turn starts a conversation.<br>The next starts a friendly rivalry.<br>That’s the Wycombe Punch experience.</p></div>
<div class="experience-grid"><article class="experience-feature reveal"><span class="micro">01 / BRING YOUR PEOPLE</span><div class="score-art" aria-hidden="true"><span>847</span><span class="outlined">912</span><span>999<span class="red">.</span></span><div class="score-art-tag">A SCORE WORTH CHASING {icon('arrow-up')}</div></div><div><h3>A little competition.<br>A lot to talk about.</h3><p>The score gives everyone something to get behind. Take turns, encourage your friends and enjoy the moment.</p></div></article>
<div class="experience-stack"><article class="feature-tile reveal"><span class="feature-icon">{icon('people')}</span><div><span class="micro">02 / KEEP IT SOCIAL</span><h3>Your gathering.<br>Your challengers.</h3><p>Made for good-natured competition at weddings, walimas, family gatherings and community events.</p></div></article><article class="feature-tile reveal"><span class="feature-icon">{icon('truck')}</span><div><span class="micro">03 / KEEP IT SIMPLE</span><h3>We plan the setup<br>around your venue.</h3><p>We’ll agree delivery, access, the hire period and collection in one clear quote. No surprise assumptions.</p></div></article></div></div>
</div></section>
<section class="section occasions-section" id="occasions" aria-labelledby="occasions-heading"><div class="wrap"><div class="section-heading"><div class="reveal"><p class="eyebrow"><span></span> WHAT’S THE OCCASION?</p><h2 id="occasions-heading">GOOD TIMES.<br><em>YOUR KIND OF EVENT.</em></h2></div><p class="section-intro reveal">For bringing people together.<br>Not just filling a corner.</p></div><div class="occasions-grid">{occasions_html}</div></div></section>
<section class="challenge-banner wrap reveal" aria-labelledby="challenge-heading"><div class="challenge-banner-copy"><p class="eyebrow"><span></span> YOUR WARM-UP STARTS HERE</p><h2 id="challenge-heading">THINK YOU CAN<br><em>HIT 999?</em></h2><p>Three rounds. One timing challenge.<br>How close can you get to the perfect score?</p><a class="button button-light" href="play.html">Play the free challenge {icon('arrow-up')}</a><p class="challenge-fine">FREE TO PLAY · NO PRIZES · JUST FOR FUN</p></div><div class="challenge-banner-art" aria-hidden="true"><span class="giant-999">999</span><div class="mini-meter"><span></span><i></i></div><span class="challenge-art-label">TIMING IS EVERYTHING.</span><div class="crosshair c1"></div><div class="crosshair c2"></div></div></section>
<section class="section how-section" id="how-it-works" aria-labelledby="how-heading"><div class="wrap"><div class="section-heading"><div class="reveal"><p class="eyebrow"><span></span> FROM IDEA TO EVENT</p><h2 id="how-heading">LESS ORGANISING.<br><em>MORE ENJOYING.</em></h2></div><p class="section-intro reveal">A straightforward plan,<br>agreed before the day.</p></div><div class="steps-grid"><article class="process-step reveal"><span class="step-number">01</span>{icon('calendar')}<h3>Tell us your plan.</h3><p>Share your date, location and occasion. We’ll discuss availability and the right setup.</p></article><article class="process-step reveal"><span class="step-number">02</span>{icon('check')}<h3>Get the details clear.</h3><p>Agree the machine, full quote, access, supervision and written hire terms.</p></article><article class="process-step reveal"><span class="step-number">03</span>{icon('bolt')}<h3>Bring on the challengers.</h3><p>Delivery, setup and collection happen as agreed. Your guests take their turns.</p></article></div></div></section>
<section class="coverage-section section" id="coverage" aria-labelledby="coverage-heading"><div class="wrap coverage-layout"><div class="coverage-copy reveal"><p class="eyebrow"><span></span> A LOCAL BUSINESS. A WIDER REACH.</p><h2 id="coverage-heading">WYCOMBE ROOTS.<br><em>BUCKINGHAMSHIRE<br>REACH.</em></h2><p>From a gathering close to home to an event across the county. Tell us where you’re planning it.</p><a class="text-link" href="#enquire">Let’s talk about your location {icon('arrow-up')}</a></div><div class="coverage-board reveal"><div class="coverage-board-header"><span class="micro">FIND YOUR CORNER OF THE COUNTY</span>{icon('pin')}</div><div class="home-base"><span class="status-dot"></span><span>HIGH WYCOMBE</span><small>OUR HOME BASE</small></div><div class="town-grid">{''.join(f'<button type="button" data-town="{t}" aria-pressed="false">{t}{icon("arrow-up")}</button>' for t in ['Marlow','Beaconsfield','Amersham','Chesham','Aylesbury','Gerrards Cross','Buckingham','Milton Keynes'])}</div><p class="coverage-response" id="coverage-response" role="status">Choose a town to add it to your event enquiry.</p><p class="field-note">Across Buckinghamshire and nearby areas. Delivery and collection quoted for your venue.</p></div></div></section>
<section class="faq-section section" id="faqs" aria-labelledby="faq-heading"><div class="wrap faq-layout"><div class="faq-heading reveal"><p class="eyebrow"><span></span> BEFORE YOUR FIRST GO</p><h2 id="faq-heading">A FEW<br><em>GOOD QUESTIONS.</em></h2><p>Need something else clarified?<br>Include it in your enquiry.</p></div><div class="faq-list reveal">{faq_html}</div></div></section>
{form_html}
</main>{footer(True)}<div class="mobile-dock"><a href="#enquire">Plan your event {icon('arrow-up')}</a><a href="play.html" aria-label="Play the 999 challenge">{icon('play')}</a></div>
</body></html>'''
write('index.html',home)

play = head('The 999 Challenge — a free timing game', 'Three rounds. One timing challenge. Play the free Wycombe Punch browser game: no payments, no prizes and no strength measurement.', 'play.html',game=True) + f'''
<body class="play-page">{header(game=True)}<main id="main"><div class="wrap game-page-heading"><div><p class="eyebrow"><span></span> THE WYCOMBE PUNCH ARCADE</p><h1>THE <em>999</em> CHALLENGE<span class="red">.</span></h1></div><p>Three rounds. One perfect moment.<br>Stop the marker in the centre.</p></div>
<section class="wrap game-layout" id="game-arena" aria-label="999 timing challenge"><div class="game-console"><div class="console-top"><span class="micro"><span class="status-dot"></span> FREE PLAY · NO PRIZES</span><span class="micro" id="game-mode-label">PRECISION MODE</span></div><div class="console-score"><span class="micro">YOUR SCORE</span><strong id="game-score">000</strong><span class="score-max">/ 999</span></div><div class="game-rounds" aria-label="Your three round scores"><div class="round-cell current"><span>ROUND 01</span><strong data-round-score="0">—</strong></div><div class="round-cell"><span>ROUND 02</span><strong data-round-score="1">—</strong></div><div class="round-cell"><span>ROUND 03</span><strong data-round-score="2">—</strong></div></div>
<div class="timing-area"><div class="timing-labels"><span class="micro">STOP AT THE CENTRE</span><span class="micro" id="round-indicator">ROUND 1 / 3</span></div><div class="timing-meter" id="timing-meter" aria-hidden="true"><span class="meter-target"></span><span class="meter-centre"></span><span class="meter-cursor" id="meter-cursor"></span><div class="meter-ticks"></div></div><p class="reduced-game-instructions" id="reduced-game-instructions" hidden>Motion-free mode: start, count one second, then stop.</p><div class="meter-axis" aria-hidden="true"><span>EARLY</span><span>PERFECT</span><span>LATE</span></div></div>
<div class="game-feedback" id="game-feedback" role="status" aria-live="polite">Ready? Start the meter, then stop it as close to the centre as you can.</div>
<button type="button" class="button game-main-button" id="game-button" disabled><span id="game-button-label">Start round 1</span>{icon('bolt')}</button><div class="game-keyboard-note">Tap the button, or focus it and use <kbd>Space</kbd> / <kbd>Enter</kbd>.</div><div class="game-console-bottom"><span>BEST THIS VISIT <strong id="session-best">000</strong></span><button type="button" class="text-link" id="game-reset" disabled>{icon('restart')} Reset</button></div><noscript><p class="preview-notice">Enable JavaScript to play. This game does not collect personal information.</p></noscript></div>
<div class="game-machine-stage" data-game-machine-stage><div class="game-stage-top"><span class="micro">WYCOMBE PUNCH / THE VIRTUAL CABINET</span><span class="micro">01—03</span></div><div class="game-stage-ghost" aria-hidden="true">PUNCH</div>{machine('arena')}<div class="game-stage-bottom"><span class="micro">PRECISION. NOT POWER.</span><span>{icon('sound-off')} ALWAYS SILENT</span></div><p class="game-art-caption">Illustrated machine. The web score measures timing, not strength.</p></div></section>
<section class="wrap game-result-card" id="game-result" hidden aria-labelledby="result-heading"><div><p class="eyebrow"><span></span> THREE ROUNDS COMPLETE</p><h2 id="result-heading">YOUR BEST: <em id="final-score">000</em></h2><p id="final-message">A score worth sharing.</p></div><div class="result-actions"><button class="button" type="button" id="play-again">Play another set {icon('restart')}</button><button class="button button-outline" type="button" id="share-score">Copy my score {icon('copy')}</button><label class="sr-only" for="score-share-fallback">Your score message</label><textarea id="score-share-fallback" readonly hidden rows="3"></textarea></div></section>
<section class="wrap game-explainer"><div><span class="micro">01 / START</span><h3>Get the marker moving.</h3><p>Start each round when you’re ready. There are three attempts in a set.</p></div><div><span class="micro">02 / TIME IT</span><h3>Aim for the centre.</h3><p>Stop on the centre line for 999. Closer timing means a higher score.</p></div><div><span class="micro">03 / HAVE ANOTHER GO</span><h3>Your best round counts.</h3><p>Challenge someone beside you to a turn. Scores stay in this page, not on a public leaderboard.</p></div></section>
<div class="wrap game-footnote"><p>Just a free browser game. No payments, prizes or betting. No personal information is collected by the game. Background effects can be switched off using the motion control; the game then becomes a motion-free one-second timing challenge.</p></div>
<section class="wrap game-to-hire"><div><span class="eyebrow">READY FOR THE REAL THING?</span><h2>BRING IT TO <em>YOUR EVENT.</em></h2><p>Weddings, walimas, family gatherings and community events across Buckinghamshire.</p></div><a class="button" href="index.html#enquire">Plan your event {icon('arrow-up')}</a></section>
</main>{footer()}</body></html>'''
write('play.html',play)

# Supporting content uses the same design system and truthful preview gates.
def legal_page(filename,title,kicker,intro,sections):
    content=''.join(f'<section><h2>{h}</h2>{body}</section>' for h,body in sections)
    return head(title,intro,filename,noindex=True)+f'<body class="inner-page">{header()}<main id="main"><div class="wrap legal-layout"><aside><p class="eyebrow"><span></span> {kicker}</p><h1>{title.upper()}<span class="red">.</span></h1><p>{intro}</p><a class="text-link" href="index.html#enquire">Back to your enquiry {icon("arrow-up")}</a></aside><article class="legal-content">{content}</article></div></main>{footer()}</body></html>'
write('booking-information.html',legal_page('booking-information.html','Booking information','CLEAR BEFORE YOU COMMIT','How an enquiry becomes an agreed hire, and what we need to check together.',[
('An enquiry is not a booking','<p>This website lets you enquire about proposed private hire. It does not take payment or show live availability. Sending an enquiry does not reserve a machine or a date.</p>'),
('Your written quote','<p>Before you commit, the quote should identify the operator, machine, hire dates and times, agreed play mode, delivery and collection, full price, any deposit and payment deadlines. Any supervision, access or transport requirements must also be clear.</p>'),
('The final hire terms','<p>Cancellation, refunds, rescheduling, damage, loss, breakdowns and responsibility during use must be covered by written terms before the booking is confirmed. These notes are not a substitute for those terms and do not remove any statutory rights.</p>'),
('Venue access and setup','<p>Tell us about door widths, steps, lifts, uneven ground and the vehicle route. The selected machine’s dimensions, weight, power requirements and manufacturer’s clearances must be checked before transport or placement is agreed.</p>'),
('Safe use and supervision','<p>The machine must be used according to its instructions, with the agreed suitable ages and responsible supervision. Keep spectators clear of the striking area. Do not use it if the equipment or setup is damaged or unsafe. Outdoor use requires prior approval and suitable protection.</p>'),
('Insurance and equipment documentation','<p>Ask for the applicable insurance and relevant equipment, electrical and risk-assessment documentation before confirming your event. This website does not claim that a particular certificate or policy has already been obtained.</p>'),
('Website artwork and online scores','<p>The cabinet on the website is a branded illustration, not a photograph of an owned machine. The homepage scores are demonstrations. The separate 999 Challenge scores timing, not physical strength. The machine supplied for hire will be agreed in writing.</p>'),
('Who you are contracting with','<div class="preview-notice" data-legal-preview>This is a pre-launch website. The operator and contact details must be completed before live enquiries and bookings are enabled.</div><p>Trading name: Wycombe Punch.<br>Operator: <span data-operator-name>To be confirmed before launch</span>.</p><p data-operator-address hidden></p>')
]))
write('privacy.html',legal_page('privacy.html','Privacy information','YOUR DETAILS, EXPLAINED','Information about the enquiry form, the free game and the choices built into this site.',[
('Pre-launch notice','<div class="preview-notice" data-legal-preview>This is a privacy template for a pre-launch website. Live enquiries are disabled by default. The operator must complete and review this notice, the provider arrangements and retention process before enabling submissions.</div>'),
('Who is responsible','<p>Wycombe Punch is the trading name. The responsible operator is <span data-operator-name>not yet specified</span>. Privacy enquiries: <a data-privacy-email>not yet specified</a>.</p><p data-operator-address hidden></p>'),
('What the enquiry asks for','<p>The form requests your name, email address, occasion, event location and, if provided, phone number, event date, duration and additional details. Please do not include sensitive information or other guests’ personal details.</p><p>Preview mode prepares the text in your browser only. It does not submit it. Copying places that text on your device’s clipboard, under your control.</p>'),
('Why the details are used','<p>When submissions are enabled, enquiry information is used to respond, discuss availability, plan venue requirements and provide a quote. The intended basis is taking steps at your request before entering a contract, or legitimate interests in responding to an organisational enquiry where appropriate. It is not a marketing subscription.</p>'),
('Where submissions go','<p>The configured submission route is <strong data-form-provider>not enabled for submissions</strong>. When activated, a form provider and the operator’s email service may process the enquiry. Hosting providers can also process standard request data, such as IP addresses, for delivery and security.</p><p data-provider-notice hidden></p><p>The operator must review the providers, any international transfers and the applicable safeguards before launch.</p>'),
('Retention','<p>The proposed retention period for unsuccessful enquiries is <span data-retention-months>12</span> months from the last meaningful contact. The operator must implement and confirm this process before launch. Booking, payment or accounting information may require different retention periods, which should be explained when collected.</p>'),
('The game and motion settings','<p>The 999 Challenge runs in your browser. Scores and the best score for the current visit are held in page memory and reset when the page is reloaded. There is no account, public leaderboard, game-payment system or game analytics. The copy-score button only writes a message to your clipboard after you request it.</p><p>The motion preference is stored for the current browser tab using session storage, where available, so it can apply between this site’s pages. It is only a display preference, not a tracking identifier.</p>'),
('Cookies, external content and social links','<p>This code does not add analytics, advertising pixels, cookie-based tracking, embedded social feeds or externally hosted fonts. This does not describe services added later by the operator or all processing by the hosting provider. Configured Instagram links open Instagram only when clicked; Instagram then applies its own privacy rules.</p>'),
('Your rights and choices','<p>Depending on the circumstances, you may request access, correction, deletion, restriction, objection or portability of your personal data. Contact the operator using the completed privacy address above. You may also complain to the UK Information Commissioner’s Office at <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</p>'),
('Updates','<p>Template prepared September 2026. The operator should update this information when the actual business details, processing arrangements or services change.</p>')
]))

brand_colours={'Punch red':'#ff2848','Ink':'#0b0b0e','Elevated charcoal':'#141419','Chalk':'#f5f3ef','Muted silver':'#a4a4af','Quiet border':'#2b2b33'}
swatches=''.join(f'<button class="swatch" data-copy="{hexval}" style="--swatch:{hexval}" type="button"><span class="swatch-colour"></span><span>{name}<strong>{hexval}</strong></span>{icon("copy")}</button>' for name,hexval in brand_colours.items())
write('brand-kit.html',head('Brand system','The Wycombe Punch identity, colour palette and interaction principles.','brand-kit.html',True)+f'''<body class="brand-page">{header()}<main id="main"><div class="wrap brand-kit"><p class="eyebrow"><span></span> WYCOMBE PUNCH / BRAND SYSTEM 02</p><h1>GOOD COMPANY.<br><em>GREAT COMPETITION.</em></h1><div class="brand-overview"><div class="brand-logo-panel"><img src="assets/logo.webp" width="340" height="340" alt="Wycombe Punch boxing machine hire emblem"></div><div><span class="micro">THE IDENTITY</span><h2>LOCAL ROOTS.<br><em>ARCADE ATTITUDE.</em></h2><p>Confident, friendly and competitive. Dark surfaces, generous space, sharp typography and one unmistakable red accent.</p><p>The supplied logo remains the approved master. Keep its proportions, give it breathing room and do not redraw it with text.</p></div></div><section><h2>THE PALETTE.</h2><div class="swatches">{swatches}</div><p class="field-note">Click a swatch to copy its value. Red on charcoal is an accent; primary red buttons use dark labels for contrast.</p></section><section class="brand-type"><span class="micro">TYPE / NO EXTERNAL FONT DOWNLOADS</span><h2>BIG TYPE.<br><em>CLEAR MESSAGE.</em></h2><p>Display: Impact / Arial Narrow / Liberation Sans Narrow / sans-serif.<br>Body: system UI sans-serif. Labels and scores: system monospace.</p><p>Keep the display copy short and uppercase. Body copy is conversational, factual and easy to scan.</p></section><section><h2>THE VOICE.</h2><div class="brand-principles"><article><h3>Good-natured.</h3><p>Friendly competition, cheering each other on and enjoying time together. No aggressive promises or humiliation.</p></article><article><h3>Faith-conscious.</h3><p>Weddings and walimas, family gatherings, community events and team activities. No music, nightlife or gambling references.</p></article><article><h3>Honest.</h3><p>No invented reviews, bookings, insurance claims, fixed prices or availability. The illustrative machine and web game are clearly labelled.</p></article></div></section><section><h2>MOTION WITH A PURPOSE.</h2><p>The bag swings on interaction. Scores count up after a hit. Content reveals on scroll. All background effects can be reduced, and the free game retains a motion-free mode. No audio, flashing sequences or paid mechanics.</p><a class="button" href="play.html">Try the interaction system {icon('arrow-up')}</a></section></div></main>{footer()}</body></html>''')

write('thank-you.html',head('Enquiry update','What happens after your enquiry is accepted by the configured form service.','thank-you.html',True)+f'''<body class="inner-page">{header()}<main id="main"><section class="wrap message-page"><span class="message-icon">{icon('check')}</span><p class="eyebrow">YOUR NEXT STEP</p><h1>LET’S GET<br><em>YOUR EVENT STARTED.</em></h1><p>If you reached this page after a successful live form submission, the configured service has accepted your enquiry. This page alone does not prove delivery and does not confirm a booking.</p><p>We’ll need to agree availability, the machine, your full quote and hire terms before any date is reserved.</p><a class="button" href="index.html">Back to Wycombe Punch {icon('arrow-up')}</a><a class="text-link" href="play.html">Have a go at the 999 challenge {icon('play')}</a></section></main>{footer()}</body></html>''')
write('404.html',head('Page not found','That page has stepped out of the ring. Return to Wycombe Punch.','404.html',True)+f'''<body class="inner-page">{header()}<main id="main"><section class="wrap message-page"><p class="error-score">404</p><p class="eyebrow">A SWING AND A MISS</p><h1>LET’S GET YOU<br><em>BACK ON TARGET.</em></h1><p>That page isn’t here. The homepage and the free 999 Challenge are a good place to start.</p><a class="button" href="index.html">Back to the homepage {icon('arrow-up')}</a><a class="text-link" href="play.html">Play the challenge {icon('play')}</a></section></main>{footer()}</body></html>''')
write('assets/machine.svg',machine('static','999').replace('aria-hidden="true" focusable="false"','xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustrative Wycombe Punch cabinet"').replace('assets/logo-small.webp','logo-small.webp').replace('<defs>','<style>.led-segment{fill:#40101c}.led-segment.lit{fill:#ff3653}.impact-rays{opacity:0}</style><defs>'))
write('CNAME','wycombepunch.com')
write('.nojekyll','')
write('robots.txt','User-agent: *\nAllow: /\nSitemap: https://wycombepunch.com/sitemap.xml')
write('sitemap.xml','''<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://wycombepunch.com/</loc></url><url><loc>https://wycombepunch.com/play.html</loc></url></urlset>''')
write('site.webmanifest',json.dumps({'name':'Wycombe Punch','short_name':'Wycombe Punch','start_url':'./','display':'browser','background_color':'#0b0b0e','theme_color':'#0b0b0e','icons':[{'src':'assets/icon-192.png','sizes':'192x192','type':'image/png'},{'src':'assets/icon-512.png','sizes':'512x512','type':'image/png'}]},indent=2))
write('netlify.toml','''[build]
  publish = "."

[build.processing]
  skip_processing = false

[build.processing.html]
  pretty_urls = false
''')
write('_redirects','/game /play.html 301\n/game.html /play.html 301\n/play /play.html 301\n/* /404.html 404')
write('_headers','''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://formspree.io; form-action 'self' https://formspree.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
/assets/*
  Cache-Control: public, max-age=3600
/assets/config.js
  Cache-Control: no-cache
''')
(ROOT/'brand-assets'/'brand-colours.json').write_text(json.dumps(brand_colours,indent=2))
print('Generated HTML, SVG, metadata and hosting files.')
