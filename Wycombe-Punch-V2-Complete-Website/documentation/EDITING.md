# EDITING THE WEBSITE

## Files

| Change | File |
|---|---|
| Contact, Instagram, form routing, optional price | `site/assets/config.js` |
| Homepage copy, event types, towns, FAQ, enquiry markup | `site/index.html` |
| Game page copy and layout | `site/play.html` |
| Palette, sizing, responsive layout, animations | `site/assets/styles.css` |
| Shared interactions, form handling, sample scores | `site/assets/app.js` |
| Actual timing game and scoring | `site/assets/game.js` |
| Operator/privacy information and reviewed policy text | `site/privacy.html` plus config |
| Booking guidance | `site/booking-information.html` |
| Social link-preview image | `site/assets/social-share.jpg` |
| Favicons and touch icons | `site/favicon.ico`, `site/assets/*icon*.png` |

No build process is required for direct HTML/CSS/JavaScript editing. The optional root `build.py` generates the shared page templates and metadata; rerunning it overwrites the corresponding generated HTML. Edit that template too if you plan to regenerate pages later.

## Keep the versions together

All pages share the same config, CSS and app script. The game additionally loads `game.js`. Keep the paths and case unchanged unless you update every reference. `play.html` is the dedicated game; `/game`, `/game.html` and `/play` redirects are supplied for hosts that support `_redirects`.

The brand guide, privacy, booking information, thank-you and error pages are marked noindex. The homepage and game are in the sitemap. Update canonical/OG/sitemap/CNAME values together if the domain changes.

## Safety of the form defaults

`enquiriesEnabled: false` is intentional, not a broken button. With no contact details yet, the site must not pretend to send an enquiry. The “prepare” action builds copyable text locally. After a supported provider is configured and enabled on a deployed site, the same button becomes a send action.

Do not remove the processing checks just to make an unconnected static server display success. Live submission requires an actual configured service and real testing.

## Performance

The site has no external font or JavaScript dependencies. The approved logo is supplied in optimised WebP variants for public use and PNG masters in the private package. Machine illustrations are SVG and need no 3D-engine download.

Do not add an autoplay music track or unrelated video background. Before adding any advertising pixel, analytics tool or social embed, review the privacy notice and any consent requirements. Keep motion preferences functional when editing animations.
