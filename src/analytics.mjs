// Reuse the Google tag loaded by GTM. Never initialize a second tag/page_view.
export function trackFeature(name, parameters = {}) {
  if (typeof window === 'undefined' || window.location.hostname !== 'train.lvnsk.jp') return;
  try {
    window.dataLayer = window.dataLayer || [];
    function event() { window.dataLayer.push(arguments); }
    event('event', name, { ...parameters, send_to: 'G-DKM4M2PE9Q' });
  } catch { /* Analytics must not interrupt play. */ }
}
