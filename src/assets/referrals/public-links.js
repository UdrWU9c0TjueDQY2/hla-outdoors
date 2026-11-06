/* Visitor-initiated public-link sharing. No form values, storage or network calls. */
(() => {
  'use strict';
  function setup(box, title, rawURL, kind) {
    let url;
    try {
      url = new URL(rawURL);
      const apple = url.origin === 'https://apps.apple.com' && /^\/app\/id[0-9]+$/.test(url.pathname);
      const guide = url.origin === location.origin && url.pathname.startsWith(location.pathname.split('/').slice(0,2).join('/') + '/');
      if (url.protocol !== 'https:' || (kind === 'app' ? !apple : !guide)) return;
      url.search = ''; url.hash = '';
    } catch (_) { return; }
    const controls = document.createElement('div'); controls.className = 'hla-referral-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = kind === 'app' ? 'Copy app link' : 'Copy guide link';
    copy.setAttribute('aria-label', (kind === 'app' ? 'Copy App Store link for ' : 'Copy public guide link for ') + title);
    const share = document.createElement('button'); share.type = 'button'; share.textContent = kind === 'app' ? 'Share app' : 'Share guide';
    share.setAttribute('aria-label', 'Share ' + title); share.hidden = typeof navigator.share !== 'function';
    const manual = document.createElement('label'); manual.className = 'hla-referral-manual'; manual.hidden = true; manual.append(document.createTextNode('Select and copy this public link'));
    const field = document.createElement('input'); field.type = 'text'; field.readOnly = true; field.value = url.href; field.setAttribute('aria-label', 'Public link for ' + title); manual.append(field);
    const status = document.createElement('p'); status.className = 'hla-referral-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    function fallback(message) { manual.hidden = false; field.focus(); field.select(); status.textContent = message; }
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
        await navigator.clipboard.writeText(url.href);
        manual.hidden = true; status.textContent = 'Link copied. Paste it wherever you choose.';
      } catch (_) { fallback('Automatic copying is unavailable. Copy the selected link.'); }
      finally { copy.disabled = false; }
    });
    share.addEventListener('click', async () => {
      share.disabled = true; status.textContent = '';
      try {
        await navigator.share({title, url: url.href});
        status.textContent = 'Share sheet closed.';
      } catch (error) {
        if (error && error.name === 'AbortError') status.textContent = 'Sharing cancelled.';
        else fallback('Sharing is unavailable here. Copy the selected link instead.');
      } finally { share.disabled = false; }
    });
    controls.append(copy, share); box.append(controls, manual, status);
  }
  document.querySelectorAll('.hla-guide-referral[data-public-url]').forEach(box => setup(box, box.dataset.shareTitle, box.dataset.publicUrl, 'guide'));
  document.querySelectorAll('.hla-install-card').forEach(card => {
    const link = card.querySelector('.hla-store-link'); const heading = card.querySelector('h3');
    if (!link || !heading || card.querySelector('.hla-app-referral')) return;
    const box = document.createElement('div'); box.className = 'hla-app-referral'; card.append(box);
    setup(box, heading.textContent.trim(), link.href, 'app');
  });
})();
