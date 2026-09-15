# START HERE — putting Wycombe Punch online

## 1. What to upload

The public website is in `site/`. Upload its **contents**, so that `index.html`, `play.html` and `assets/` are at the hosting root. Do not upload the complete project as a folder inside your site.

The separate **Upload-Ready ZIP** already contains only those public files. Extract it before using a drag-and-drop host that expects a folder.

You can open `site/index.html` in a browser to try the design and game. Opening local files deliberately keeps enquiries in preview mode.

## 2. Connect real contact details

Open `site/assets/config.js` in a text editor. Set:

```js
business: {
  tradingName: 'Wycombe Punch',
  operatorName: 'YOUR REAL OPERATOR NAME',
  privacyEmail: 'YOUR REAL MONITORED EMAIL',
  contactAddress: 'YOUR ACTUAL BUSINESS CONTACT ADDRESS, WHERE APPROPRIATE'
},
contact: {
  email: 'YOUR REAL PUBLIC EMAIL',
  instagramUsername: 'YOUR CONFIRMED HANDLE WITHOUT @'
}
```

These placeholders illustrate the fields; do not publish them as real details. Filling in an email address does **not** create a mailbox. The Instagram field must be the account you actually control; blank contact settings hide the links.

The contact information is public. Do not add passwords, private API keys or information that should not appear on a public website.

## 3. Connect the enquiry form

### Route A — Netlify Forms

1. Deploy the contents of `site/` to your Netlify project.
2. In that project's Forms area, **enable form detection**.
3. Set `form.provider` to `'netlify'` and complete the operator/privacy information.
4. Review the privacy notice, your business operation and the remaining launch checks below.
5. Set `enquiriesEnabled: true`, then **redeploy**. Netlify must process the HTML form.
6. Check that the form named `wycombe-punch-enquiry` appears in the project.
7. Configure the submission notification destination in the host's form settings.
8. Submit a test from the real deployed website. Check both the provider dashboard **and the actual inbox**, including spam. Also check mobile submission and failure handling.

The JavaScript refuses to treat an unprocessed static HTML form as a working Netlify integration. Enabling submissions in config alone is not enough.

For a Git-based deployment of the complete project, the root `netlify.toml` publishes `site/`. The `site/netlify.toml` is for deployment with `site/` itself as the project root. Use one layout consistently.

### Route B — another static host + Formspree

Create a form with the provider. Set `form.provider` to `'formspree'` and `form.endpoint` to your actual `https://formspree.io/f/...` endpoint. Complete the operator/privacy details, review the provider arrangements and set `enquiriesEnabled: true`.

Deploy and test receipt from the public HTTPS site. Provider account verification, quotas, billing, anti-spam settings and any allowed-domain configuration are separate from the website code.

### Route C — email-draft fallback

Set `form.provider` to `'email'`, add a monitored email address and complete the other required settings. This opens the visitor's email application with a draft. It **does not automatically send anything**, and the interface says so. The visitor must press Send in their email app.

## 4. Connect wycombepunch.com

A domain registration alone does not host the files. Add the custom domain to your chosen hosting project and follow that host's current DNS instructions. Make both the apex domain and `www` resolve as intended; choose one primary version and redirect the other. The included canonical URLs use `https://wycombepunch.com/`.

Use the DNS records shown for **your project**, not guessed IP addresses from an example. Preserve existing MX and email-related TXT records. Wait for DNS and HTTPS provisioning, then test the public site.

Do not assume a completed ZIP means anything has been deployed or that your DNS has already changed.

## 5. Review before accepting business

- Confirm the actual contracting operator and any provider/contract age requirements. Do not enter a false date of birth or use another person's account without an accepted, genuine arrangement.
- Confirm the selected machine, transport, venue access, age suitability, supervision, safe-use instructions and relevant equipment/insurance arrangements. The artwork is not proof that a machine has been purchased.
- Agree the real package, quote process, delivery charges, deposits, cancellation terms and breakdown arrangements. The booking-information page is guidance, not bespoke legal hire terms.
- Complete and review the privacy notice. Confirm form/email providers, retention, any international processing and the genuine contact address.
- Keep prices quote-based until the real offer is decided. There is an optional £200 guide-price setting, but it is hidden by default and is not a confirmed package.
- Test the form's success and failure states, actual inbox receipt, social links, small-screen layout and your domain's HTTPS.

No online payments, availability database, insurance certification, religious certification or legal compliance certification is supplied by this code.

## 6. Replacing your previous site

Back up the existing live files and settings first. This redesign replaces the old HTML/CSS/JavaScript as a complete set; do not mix the old `app.js` or `styles.css` with the new pages. Carry over only verified contact/form settings deliberately. Refresh the host's cache if it continues to serve old files.

## Official technical references checked during production

- Netlify Forms setup and detection: https://docs.netlify.com/manage/forms/setup/
- Netlify external DNS: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/
- Reduced-motion preference: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

No host's paid plan or pricing is assumed. Consult the provider's current dashboard and terms before launch.
