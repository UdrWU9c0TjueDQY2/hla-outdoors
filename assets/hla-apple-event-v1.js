(() => {
  const events = Array.from(document.querySelectorAll('[data-hla-apple-event]'), element => ({
    element,
    starts: Date.parse(element.dataset.starts),
    ends: Date.parse(element.dataset.ends)
  }));
  if (!events.length) return;

  let timer;
  function refresh() {
    window.clearTimeout(timer);
    const now = Date.now();
    let nextChange = Infinity;
    for (const { element, starts, ends } of events) {
      const valid = Number.isFinite(starts) && Number.isFinite(ends) && starts < ends;
      element.hidden = !(valid && starts <= now && now < ends);
      if (valid && ends > now) {
        nextChange = Math.min(nextChange, starts > now ? starts : ends);
      }
    }
    if (Number.isFinite(nextChange)) {
      timer = window.setTimeout(refresh, Math.min(nextChange - now, 2147483647));
    }
  }

  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  refresh();
})();
