/** WYCOMBE PUNCH — PUBLIC WEBSITE SETTINGS
 * Edit these settings, then re-upload. No build command is required.
 * Never put API secrets, passwords or private information in this file.
 * Read documentation/START-HERE.md before enabling live enquiries.
 */
window.WP_CONFIG = Object.freeze({
  enquiriesEnabled: false, // Safe preview: prepares/copies details, never pretends to send.
  business: {
    tradingName: 'Wycombe Punch',
    operatorName: '', // Real contracting person or registered company.
    privacyEmail: '', // A real monitored mailbox; this does not create one.
    contactAddress: '' // Genuine business contact address, where appropriate.
  },
  contact: {
    email: '',
    instagramUsername: '' // Only your confirmed handle, without @. Blank = no fake link.
  },
  form: {
    provider: 'netlify', // 'netlify', 'formspree' or 'email'.
    endpoint: '', // Formspree only: https://formspree.io/f/REAL_FORM_ID
    timeoutMs: 15000
  },
  pricing: {
    showGuidePrice: false, // Keep quote-based until your real package is decided.
    guidePriceGBP: 200
  },
  privacy: { enquiryRetentionMonths: 12 }
});
