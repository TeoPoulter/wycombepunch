/* Accessible, dependency-free choices and calendar. Values stay in named form fields. */
(() => {
  'use strict';
  const form = document.querySelector('#enquiry-form');
  if (!form) return;
  const blocked = () => form.dataset.transitioning === 'true' || document.getElementById('enquiry-fields').disabled;
  const commit = field => form.dispatchEvent(new CustomEvent('wp:choice-commit', { detail: { field: field.id, value: field.value } }));
  form.addEventListener('keydown', event => {
    if (event.repeat && ['Enter', ' '].includes(event.key) && event.target.closest('button')) event.preventDefault();
  });
  const groups = [...form.querySelectorAll('[data-choice-group]')];
  function syncChoices() {
    groups.forEach(group => {
      const value = document.getElementById(group.dataset.choiceGroup).value;
      const buttons = [...group.querySelectorAll('[data-choice]')];
      buttons.forEach((button, index) => {
        const selected = button.dataset.choice === value;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected || (!value && index === 0) ? 0 : -1;
      });
    });
  }
  groups.forEach(group => {
    const field = document.getElementById(group.dataset.choiceGroup);
    const buttons = [...group.querySelectorAll('[data-choice]')];
    const choose = (button, committed = false) => {
      if (blocked()) return;
      field.value = button.dataset.choice;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      if (committed) commit(field);
    };
    buttons.forEach(button => button.addEventListener('click', () => choose(button, true)));
    group.addEventListener('keydown', event => {
      if (blocked() || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + delta + buttons.length) % buttons.length;
      choose(buttons[index]); buttons[index].focus();
    });
    field.addEventListener('change', syncChoices);
  });

  const date = document.getElementById('event-date');
  const days = document.getElementById('calendar-days');
  const monthLabel = document.getElementById('calendar-month');
  const previous = form.querySelector('[data-calendar-prev]');
  const next = form.querySelector('[data-calendar-next]');
  const undecided = document.getElementById('date-undecided');
  const selection = document.getElementById('date-selection');
  const today = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12); };
  const iso = value => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  let month = new Date(today().getFullYear(), today().getMonth(), 1, 12);
  function renderCalendar(focusDate) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const count = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const label = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const monthChanged = monthLabel.textContent && monthLabel.textContent !== label;
    monthLabel.textContent = label;
    previous.disabled = month.getFullYear() === today().getFullYear() && month.getMonth() === today().getMonth();
    days.replaceChildren();
    for (let i=0; i<offset; i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden','true'); days.append(blank); }
    for (let d=1; d<=count; d++) {
      const value = new Date(month.getFullYear(),month.getMonth(),d,12);
      const key = iso(value);
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = String(d); button.dataset.date = key;
      button.disabled = key < iso(today());
      button.setAttribute('aria-label', value.toLocaleDateString('en-GB',{ weekday:'long',day:'numeric',month:'long',year:'numeric' }));
      button.setAttribute('aria-pressed', String(date.value === key));
      if (key === iso(today())) button.setAttribute('aria-current','date');
      button.addEventListener('click', () => {
        if (blocked()) return;
        date.value = key; date.dataset.chosen = 'true';
        date.dispatchEvent(new Event('change',{bubbles:true})); renderCalendar(key); commit(date);
      });
      days.append(button);
    }
    // Six rows keep the month controls still while shorter months fade in.
    for (let i=offset+count; i<42; i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden','true'); days.append(blank); }
    // The parent fieldset stays disabled until app.js has installed its listeners.
    const available = [...days.querySelectorAll('button')].filter(button => !button.disabled);
    const active = available.find(button => button.dataset.date === (focusDate || date.value)) || available[0];
    available.forEach(button => { button.tabIndex = button === active ? 0 : -1; });
    if (focusDate) active?.focus({preventScroll:true});
    if (monthChanged) {
      days.classList.remove('month-enter');
      void days.offsetWidth;
      days.classList.add('month-enter');
    }
    undecided.setAttribute('aria-pressed', String(date.dataset.chosen === 'true' && !date.value));
    // This is an alternative action, not a status saying the selected date is unknown.
    undecided.textContent = date.value ? 'Clear date — decide later' : 'Not decided yet';
    selection.textContent = date.value ? 'Selected: ' + new Date(`${date.value}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : date.dataset.chosen === 'true' ? 'Date to be confirmed — no problem.' : '';
  }
  previous.addEventListener('click', () => { if (blocked()) return; month.setMonth(month.getMonth()-1); renderCalendar(); });
  next.addEventListener('click', () => { if (blocked()) return; month.setMonth(month.getMonth()+1); renderCalendar(); });
  undecided.addEventListener('click', () => {
    if (blocked()) return;
    date.value = ''; date.dataset.chosen = 'true'; date.dispatchEvent(new Event('change',{bubbles:true})); renderCalendar(); commit(date);
  });
  days.addEventListener('keydown', event => {
    const target = event.target.closest('[data-date]');
    if (blocked() || event.altKey || event.ctrlKey || event.metaKey || !target || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) return;
    event.preventDefault();
    const value = new Date(`${target.dataset.date}T12:00:00`);
    const weekday = (value.getDay()+6)%7;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      const day = value.getDate(); value.setDate(1); value.setMonth(value.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      value.setDate(Math.min(day,new Date(value.getFullYear(),value.getMonth()+1,0).getDate()));
    } else value.setDate(value.getDate() + ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[event.key]));
    const safe = value < today() ? today() : value;
    month = new Date(safe.getFullYear(),safe.getMonth(),1,12); renderCalendar(iso(safe));
  });
  // Keep one named phone field for the existing submission contract. Visible
  // parts remain editable; only the UK trunk zero is removed automatically.
  const phone = document.getElementById('phone');
  const country = document.getElementById('phone-country');
  const national = document.getElementById('phone-national');
  const twoDigitCodes = new Set('20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98'.split(' '));
  function splitInternational(raw) {
    if (!/^(?:\+|00)[\d\s().-]+$/.test(raw.trim())) return null;
    const digits = raw.trim().replace(/^(?:\+|00)/, '').replace(/\D/g, '');
    if (digits.length < 5) return null;
    const length = ['1','7'].includes(digits[0]) ? 1 : twoDigitCodes.has(digits.slice(0,2)) ? 2 : 3;
    return { code: '+' + digits.slice(0,length), number: digits.slice(length) };
  }
  function syncPhone(normalize = false) {
    if (!phone || !country || !national) return;
    const pasted = splitInternational(national.value);
    if (pasted) { country.value = pasted.code; national.value = pasted.number; }
    const code = country.value.trim().replace(/^00/, '+').replace(/^\+?/, '+');
    let digits = national.value.replace(/\D/g, '');
    if (code === '+44') digits = digits.replace(/^0+/, '');
    phone.value = /^\+[1-9]\d{0,2}$/.test(code) && /^[()\d\s.\-]*$/.test(national.value) && digits ? `${code} ${digits}` : '';
    if (normalize && /^\+[1-9]\d{0,2}$/.test(code)) country.value = code;
  }
  if (country && national) {
    [country,national].forEach(input => {
      input.addEventListener('input', () => syncPhone());
      input.addEventListener('change', () => syncPhone(true));
    });
    national.addEventListener('paste', event => {
      const pasted = splitInternational(event.clipboardData?.getData('text') || '');
      if (!pasted) return;
      event.preventDefault(); country.value = pasted.code; national.value = pasted.number;
      syncPhone(true); national.dispatchEvent(new Event('input', { bubbles:true }));
    });
    form.addEventListener('wp:sync-phone', () => syncPhone(true));
    syncPhone();
  }
  form.addEventListener('reset', () => queueMicrotask(() => {
    date.dataset.chosen = ''; month = new Date(today().getFullYear(),today().getMonth(),1,12);
    syncChoices(); renderCalendar(); syncPhone();
  }));
  syncChoices(); renderCalendar();
})();
