// Small helpers shared by every page. No DOM work happens at import time.

/** Escape text before putting it inside an HTML string (prevents XSS). */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const longDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const releaseFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const priceFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatTime = (dateLike) => timeFmt.format(new Date(dateLike));
export const formatLongDate = (dateLike) => longDateFmt.format(new Date(dateLike));
export const formatPrice = (amount) => priceFmt.format(amount);

export function formatDateParts(dateLike) {
  const d = new Date(dateLike);
  return { weekday: weekdayFmt.format(d), dayMonth: dayMonthFmt.format(d) };
}

/** 'YYYY-MM-DD' (a plain date from the API) shown as a readable date, without timezone shifts. */
export const formatReleaseDate = (ymd) => releaseFmt.format(new Date(`${ymd}T00:00:00`));

/** Local calendar day as 'YYYY-MM-DD' (matches the ?date= parameter in the API contract). */
export function toDateKey(dateLike) {
  const d = new Date(dateLike);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const getParam = (name) => new URLSearchParams(window.location.search).get(name);

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Path prefix back to the frontend root: '' on index.html, '../' on pages/*.html (set via <body data-root>). */
export const root = () => document.body.dataset.root || '';
