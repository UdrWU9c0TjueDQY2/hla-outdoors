// build.mjs - Honest Little Apps hub builder. Node built-ins only. Never fails the build.
// Copies src/ to dist/, fills <!--HLA:...--> placeholders, writes sitemap.xml, feed.xml, pages.json,
// robots.txt (unless src has one) and the IndexNow key file.
import fs from 'node:fs';
import path from 'node:path';
 
const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const BASE = site.baseUrl.replace(/\/$/, '');
// HLA patch (hla-0d020d): when the site lives under a path prefix (GitHub Pages project sites), rewrite root-relative URLs.
const PREFIX = new URL(BASE).pathname.replace(/\/$/, '');
const pre = p => PREFIX + p;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const warn = m => console.log('WARN', m);
 
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(SRC, DIST, { recursive: true });
 
// collect pages from meta.json files
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('_') && e.name !== 'assets') walk(p); continue; }
    if (e.name !== 'meta.json') continue;
    try {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'));
      const rel = path.relative(SRC, dir).split(path.sep).join('/');
      if (!m.title || !m.appSlug) { warn(`meta missing title/appSlug: ${rel}`); continue; }
      if (m.draft) continue;
      m.path = rel ? `/${rel}/` : '/';
      m.url = BASE + m.path;
      m.updated = m.updated || m.published || new Date().toISOString().slice(0, 10);
      m.tags = Array.isArray(m.tags) ? m.tags : [];
      pages.push(m);
    } catch (err) { warn(`bad meta.json ${p}: ${err.message}`); }
  }
})(SRC);
pages.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
for (const p of fs.readdirSync(DIST, { recursive: true })) if (String(p).endsWith('meta.json')) fs.rmSync(path.join(DIST, String(p)));
 
const list = (items, cls = 'hla-links') => items.length
  ? `<ul class="${cls}">` + items.map(p => `<li><a href="${pre(p.path)}">${esc(p.linkText || p.title)}</a>${p.description ? `<span>${esc(p.description)}</span>` : ''}</li>`).join('') + '</ul>'
  : '';
const appName = slug => (site.apps.find(a => a.slug === slug) || {}).name || slug;
 
function related(me, n = 4) {
  const scored = pages.filter(p => p.path !== me.path).map(p => {
    let s = 0;
    if (p.appSlug === me.appSlug) s += 3;
    for (const t of p.tags) if (me.tags.includes(t)) s += 1;
    if (p.strategy === 'app-home' && p.appSlug === me.appSlug) s += 2;
    return { p, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.p);
  const out = scored.slice(0, n);
  for (const p of pages) { if (out.length >= n) break; if (p.path !== me.path && !out.includes(p)) out.push(p); }
  return out;
}
 
// fill placeholders in every html file
let filled = 0;
for (const f of fs.readdirSync(DIST, { recursive: true })) {
  const file = path.join(DIST, String(f));
  if (!file.endsWith('.html')) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('<!--HLA:')) continue;
  const relDir = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
  const me = pages.find(p => p.path === (relDir ? `/${relDir}/` : '/')) || { path: '', appSlug: '', tags: [] };
  html = html
    .replace(/<!--HLA:RELATED(?::(\d+))?-->/g, (_, n) => list(related(me, Number(n) || 4)))
    .replace(/<!--HLA:LATEST(?::(\d+))?-->/g, (_, n) => list(pages.filter(p => p.path !== me.path).slice(0, Number(n) || 8)))
    .replace(/<!--HLA:APP:([a-z0-9-]+)(?::(\d+))?-->/g, (_, slug, n) => list(pages.filter(p => p.appSlug === slug && p.strategy !== 'app-home' && p.path !== me.path).slice(0, Number(n) || 50)))
    .replace(/<!--HLA:HUB-APPS-->/g, () => '<ul class="hla-apps">' + site.apps.map(a => { const home = pages.find(p => p.appSlug === a.slug && p.strategy === 'app-home'); const n = pages.filter(p => p.appSlug === a.slug && p.strategy !== 'app-home').length; const href = home ? pre(home.path) : `https://apps.apple.com/app/id${a.id}?ct=${(site.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}-hub&mt=8`; const desc = home ? esc(home.description || '') : `Free on iPhone${n ? ` · ${n} page${n > 1 ? 's' : ''} on this site` : ''}`; return `<li><a href="${href}"${home ? '' : ' rel="noopener"'}>${esc(a.name)}</a><span>${desc}</span></li>`; }).join('') + '</ul>')
    .replace(/<!--HLA:YEAR-->/g, String(new Date().getUTCFullYear()));
  fs.writeFileSync(file, html);
  filled++;
}
if (PREFIX) {
  for (const f of fs.readdirSync(DIST, { recursive: true })) {
    const file = path.join(DIST, String(f));
    if (!/\.(html|css|xml|webmanifest)$/.test(file) || !fs.statSync(file).isFile()) continue;
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/https:\/\/[a-z0-9-]+\.pages\.dev(?=[\/"'<\s])/g, BASE) // pages written for a pages.dev base: point canonicals at this host
      .replace(/(href|src|content|action|data-src)="(\/(?!\/)[^"]*)"/g, (m, attr, url) => `${attr}="${url === PREFIX || url.startsWith(PREFIX + "/") ? url : PREFIX + url}"`).replace(/url\(\/(?!\/)/g, `url(${PREFIX}/`).replace(/srcset="([^"]*)"/g, (m, v) => `srcset="${v.replace(/(^|,\s*)\//g, `$1${PREFIX}/`)}"`);
    fs.writeFileSync(file, html);
  }
}
 
// sitemap, feed, index, robots, indexnow key
const staticUrls = ['/', '/about/', '/privacy/'].filter(u => fs.existsSync(path.join(SRC, u, 'index.html')));
const today = new Date().toISOString().slice(0, 10);
const urls = [...staticUrls.filter(u => !pages.some(p => p.path === u)).map(u => ({ url: BASE + u, updated: today })), ...pages];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${esc(u.url)}</loc><lastmod>${esc(u.updated)}</lastmod></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(DIST, 'feed.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n<title>${esc(site.name)}</title>\n<link href="${BASE}/"/>\n<id>${BASE}/</id>\n<updated>${today}T00:00:00Z</updated>\n` +
  pages.slice(0, 50).map(p => `<entry><title>${esc(p.title)}</title><link href="${esc(p.url)}"/><id>${esc(p.url)}</id><updated>${esc(p.updated)}T00:00:00Z</updated><summary>${esc(p.description)}</summary></entry>`).join('\n') + '\n</feed>\n');
fs.writeFileSync(path.join(DIST, 'pages.json'), JSON.stringify(pages.map(({ title, description, appSlug, strategy, query, tags, path: p, url, published, updated }) => ({ title, description, appSlug, strategy, query, tags, path: p, url, published, updated })), null, 1));
if (!fs.existsSync(path.join(SRC, 'robots.txt'))) {
  const bots = ['Googlebot', 'Bingbot', 'Applebot', 'OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'DuckDuckBot'];
  fs.writeFileSync(path.join(DIST, 'robots.txt'), bots.map(b => `User-agent: ${b}\nAllow: /\n`).join('\n') + `\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
}
if (site.indexNowKey) fs.writeFileSync(path.join(DIST, `${site.indexNowKey}.txt`), site.indexNowKey);
console.log(`built ${pages.length} pages, filled ${filled} html files, ${urls.length} sitemap urls`);
