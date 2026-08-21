# Calculate

A production-ready static website of free calculators and converters: secondary-market seller payouts, mortgage and refinance math, health estimates, DIY material takeoffs, unit conversion, and percentages.

No build step, no npm, no framework. Open a file or drop the folder on any static host.

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

Every tool page and the homepage include labeled empty ad slots (`728×90`, `300×250`, in-article). They are not fake ads. When you are approved for a network (for example Google AdSense), replace the inner `.ad-frame` markup with the network’s unit code. Keep the visible “Advertisement” label.

The [Privacy Policy](privacy.html) and [Terms](terms.html) are written for a tools + display-ads site.

## How calculations work

All math runs in the browser (`js/calculators.js`, `js/converters.js`). Inputs are not posted to a server. Theme preference is stored in `localStorage` under `calculate-theme`.

| Tool | Formula / method |
| --- | --- |
| Marketplace / ticket resale | Typical published seller fees (overridable) |
| Mortgage / loan / refinance | Standard fixed-rate amortization |
| Compound interest | Period-by-period compounding + contributions |
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
  calculators/   (one HTML page per tool)
  robots.txt  sitemap.xml  favicon.svg  README.md
```

## Dark mode

A header toggle switches light and dark. The choice is persisted. First visit follows `prefers-color-scheme`.
