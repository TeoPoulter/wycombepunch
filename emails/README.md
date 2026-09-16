# Wycombe Punch enquiry receipt

Owner-approved direction: Wycombe Punch is the public brand, with Instagram as its contact route. Do not include the owner’s personal name, phone number or email in website copy, acknowledgements or linked assets. A future automatic acknowledgement may use a verified Wycombe Punch domain sender.

- Subject: **Thanks for your enquiry | Wycombe Punch**.
- HTML and plain-text content: `enquiry-confirmation.html` and `enquiry-confirmation.txt`.
- Fixed receipt copy, approved logo, dark/red palette and system-font fallbacks. Email clients can render fonts and colours differently; a browser preview is not an inbox delivery test.
- No customer-supplied HTML, arbitrary subject, promotional subscription or booking-confirmed wording.
- Planned sender: **Wycombe Punch <no-reply@wycombepunch.com>** after Resend verification. Sending-domain verification does not create an incoming mailbox. The email points customers to @wycombepunchmachine on Instagram. Do not add a personal Reply-To address.

The template is prepared, not a claim of active automatic sending. The owner chose free Resend plus a Cloudflare Worker/D1 receipt outbox, preserving Formspree as the enquiry destination. Account access, provider-specific email DNS records, secrets, database, Turnstile and live delivery verification are still required. No paid plan was selected.

The prepared server implementation is in `../enquiry-backend/`. Run its template-sync command when changing these files so retries use the same approved receipt. Only activate the website's worker provider after staging checks and an explicitly authorised live test confirm acceptance and email delivery.
