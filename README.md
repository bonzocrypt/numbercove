# NumberCove

A production-ready static website of free calculators and converters: secondary-market seller payouts, mortgage and real-estate math, options analysis and income strategies, health estimates, DIY material takeoffs, unit conversion, and percentages.

No npm, no framework, no runtime dependencies. A small Node build script (below) generates shared navigation and indexes; the output is plain static HTML for any host.

## Open locally

1. Double-click `index.html`, or
2. From this folder, start any static server, for example:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080/`.

A server is optional. Relative links work with `file://` as well.

## Hosting

Upload the entire folder (keep the same structure) to:

- GitHub Pages / Cloudflare Pages / Netlify / Vercel (static)
- Any Apache, nginx, or S3 + CloudFront bucket
- A traditional shared-hosting `public_html` directory

Set the site root to this directory so `/css/styles.css` and `/calculators/mortgage.html` resolve.

## Build (navigation, hubs, search, sitemap)

The site is still plain static HTML, but shared parts are generated from one source of truth:

- `data/site.json`: categories, subcategories, the "Should I…?" collection, and the author profile.
- `data/tools.json`: every calculator (title, URL, subcategory, summary, icon, keywords, AI-index text, method, dates). Set `"status": "live"` to publish.

Run the build after any change to those files or to a framework calculator:

```bash
node build/build.js
```

It rewrites the header (mega menu), mobile menu, footer, breadcrumbs, byline, and related links inside every page between `<!-- nc:NAME -->` markers, generates the category, subcategory, collection, author, and home pages, writes `js/search-index.js`, `tools.json`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and `.well-known/llms.txt`, and stamps content-hash versions on CSS and JS. It is idempotent: a second run reports "No changes."

## Adding a calculator (framework)

1. `js/calc/<id>.js`: inputs, `compute()`, and `render()` (verdict, stats, charts, tables). See `js/calc/storage-unit.js`.
2. `build/pages/<id>.js`: SEO title, description, lede, method, sources, FAQs.
3. Add an entry to `data/tools.json` with `"status": "live"`.
4. `node build/build.js`, then run the tests in `tests/`.

Shared runtime: `js/nc-calc.js` (form reading, validation, URL sharing, verdict and stats), `js/nc-charts.js` (line charts with hover readouts, bar charts). Hub URLs use folders, so preview with a local server (`python -m http.server 8080`) rather than opening files directly.

## Tests

```bash
node tests/site-integrity.test.js
node tests/options-engine.test.js
node tests/strategy-calculators.test.js
node tests/calc-batch1.test.js
```

## Production domain

The live origin is **[NumberCove.com](https://www.numbercove.com/)**. Canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, `llms.txt`, and `tools.json` all use `https://www.numbercove.com/`.

When you connect hosting, point both `numbercove.com` and `www.numbercove.com` at this folder (redirect the one you are not using to `https://www.numbercove.com`). Create inboxes for `hello@numbercove.com` and `privacy@numbercove.com` (used on the contact and privacy pages).

## AI assistants (ChatGPT, Claude, Grok, Gemini, …)

The site is set up so crawlers and answer engines can find and cite specific tools:

- `robots.txt` allows major AI bots (GPTBot, OAI-SearchBot, ClaudeBot, Grok/xAI, Google-Extended, PerplexityBot, Applebot-Extended, and others) and does not block training or retrieval.
- `llms.txt` is an [llmstxt.org](https://llmstxt.org/) index of every calculator with a one-line description.
- `llms-full.txt` is a longer brief: when to recommend each URL, and how the formulas work.
- `tools.json` is a machine-readable catalog (name, URL, category, keywords).
- `.well-known/llms.txt` and `ai.txt` point at those files.
- Homepage JSON-LD includes `WebSite`, `ItemList` of tools, and `FAQPage`. Each calculator has `WebApplication` schema with `isAccessibleForFree`.

After the site is live, submit `https://www.numbercove.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools (Bing also feeds Copilot).

## Ads

The site does not display empty advertising placeholders. If an ad network is enabled later, add its units only where an ad will actually be served and keep each unit clearly labeled as an advertisement.

The Google AdSense loader is limited to substantive calculator pages that may be monetized after approval. The navigation-focused homepage uses the verification-only AdSense meta tag, and About, Contact, Privacy, and Terms do not load ad code. The root `ads.txt` authorizes the NumberCove publisher account. No manual ad units are present while the site is awaiting approval.

The [Privacy Policy](privacy.html) and [Terms](terms.html) cover the current affiliate promotion and possible future display advertising.

## How calculations work

All math runs in the browser (`js/calculators.js`, `js/converters.js`). Inputs are not posted to a server. Theme preference is stored in `localStorage` under `calculate-theme`.

| Tool | Formula / method |
| --- | --- |
| Marketplace / ticket resale | Typical published seller fees (overridable) |
| Mortgage / loan / refinance | Standard fixed-rate amortization |
| Compound interest | Period-by-period compounding + contributions |
| Options | Black-Scholes-Merton (European); Leisen-Reimer binomial tree with Richardson extrapolation (American); IV solved by bisection |
| Covered call / cash-secured put | Expiration payoff, assignment economics, annualized return, and risk-neutral finish-ITM estimate |
| Expected move | Spot × IV × √(calendar days / 365), plus editable ATM-straddle estimate |
| Options roll / wheel | Campaign cash-flow ledger, economic breakeven, and before/after roll comparison |
| BMI | WHO formula (metric or 703 × lb / in²) |
| Body fat | U.S. Navy circumference (estimate only) |
| TDEE | Mifflin–St Jeor × activity factor |
| Paint / flooring / tile / concrete | Geometric takeoff + waste |
| Converters | SI / NIST customary factors |

Finance and health pages include disclaimers. Results are planning estimates, not professional advice.

## Project layout

```
NumberCove/
  index.html
  about.html  privacy.html  terms.html  contact.html
  css/styles.css
  js/app.js  js/calculators.js  js/converters.js
  js/options-engine.js  js/options.js   (options calculator)
  js/strategy-calculators.js             (income, expected-move, and roll/wheel calculators)
  calculators/   (one HTML page per tool)
  robots.txt  sitemap.xml  favicon.svg  README.md
```

## Dark mode

A header toggle switches light and dark. The choice is persisted. First visit follows `prefers-color-scheme`.
