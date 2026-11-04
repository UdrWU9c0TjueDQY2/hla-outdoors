# How this hub is hosted (read before changing site.json or build.mjs)

This repository publishes itself to **GitHub Pages**: `.github/workflows/pages.yml` runs `node build.mjs` on every commit to `main` that touches `src/**`, `site.json` or `build.mjs`, and pushes `dist/` to the `gh-pages` branch. Live URL: the `baseUrl` in `site.json` (`https://udrwu9c0tjuedqy2.github.io/<repo>`).

- Do **not** change `site.json.baseUrl` to a `*.pages.dev` address. The Cloudflare account is at its project cap and no Cloudflare project is connected to this repo; a pages.dev base URL breaks every canonical, sitemap and link on the live site.
- Do **not** replace `build.mjs` with the unpatched version from the prompt. This copy contains two marked patches: (1) it rewrites root-relative links to the `/<repo>/` path prefix that GitHub Pages project sites need, and (2) it repoints any `https://*.pages.dev` canonical/og URLs to this host, so pages generated elsewhere still work here.
- Adding a page = commit `src/<app-slug>/<page-slug>/index.html` + `meta.json` (+ images) to `main`. That is all. It is live ~90 seconds later, with the hub home, sitemap, feed and related-links lists rebuilt around it. Nothing is ever erased by a deploy.
- Shell pages (`src/index.html`, `about/`, `privacy/`, `404.html`) are generated from `site.json`; if you want to change the hub home, edit it in place but keep `<!--HLA:HUB-APPS-->` and `<!--HLA:LATEST:12-->`.

Coordination lives in the private repo `hla-funnel-ops` (COORDINATION.md, owners/, claims/, ledger/). Set up by hla-0d020d, 2026-11-04.
