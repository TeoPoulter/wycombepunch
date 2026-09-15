/** WYCOMBE PUNCH — PUBLIC WEBSITE SETTINGS
 * Edit these settings, then re-upload. No build command is required.
 * Never put API secrets, passwords or private information in this file.
 * Read documentation/START-HERE.md before enabling live enquiries.
 */
window.WP_CONFIG = Object.freeze({
  dailyScore: { endpoint: '' }, // Add the deployed shared-score service URL when ready.
  enquiriesEnabled: true,
  business: {
    tradingName: 'Wycombe Punch',
    operatorName: 'Wycombe Punch', // Operator name supplied by the owner.
    privacyEmail: '', // Public privacy contact uses the verified Instagram account.
    contactAddress: '' // Genuine business contact address, where appropriate.
  },
  contact: {
    email: '',
    instagramUsername: 'wycombepunchmachine' // Only your confirmed handle, without @. Blank = no fake link.
  },
  form: {
    provider: 'formspree',
    endpoint: 'https://formspree.io/f/xppwapkw', // Public form ID; recipient is private in Formspree.
    timeoutMs: 15000
  },
  pricing: {
    showGuidePrice: false, // Keep quote-based until your real package is decided.
    guidePriceGBP: 200
  },
  privacy: { enquiryRetentionMonths: 12 }
});
