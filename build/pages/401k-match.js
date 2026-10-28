module.exports = {
  id: "401k-match",
  seoTitle: "401(k) Match Calculator 2026: Get the Full Match Without Maxing Out Too Early | NumberCove",
  description: "Find the 401(k) contribution percentage that captures your full employer match without hitting the 2026 $24,500 limit early. Per-paycheck matching, true-ups, bonuses, catch-up contributions, and vesting.",
  h1: "401(k) match & paycheck pacing calculator",
  lede: "Front-load your 401(k) and you can hit the annual limit in the fall, and your employer's per-paycheck match stops with it. Find the percentage that maxes out on your last paycheck and keeps every match dollar.",
  appCategory: "FinanceApplication",
  formTitle: "Your plan",
  resultTitle: "Your contribution plan",
  method: [
    { h: "Paycheck by paycheck", html: "<p>Each paycheck, you contribute your percentage of eligible pay until you reach your annual limit. If your plan matches per paycheck, the match is figured on that paycheck's contribution, so months with no contribution get no match unless the plan makes a year-end true-up.</p>" },
    { h: "Match tiers", html: "<p>Tiers stack: “100% on the first 3% of pay, then 50% on the next 2%” means a full match requires contributing 5% and pays 4% of pay.</p><p class=\"formula\">Match = Σ tier rate × min(contribution above the tier's start, tier width × pay)</p>" },
    { h: "2026 IRS limits", html: "<ul><li>Employee deferrals: $24,500.</li><li>Catch-up at 50 or older: $8,000 more; ages 60 to 63: $11,250 more.</li><li>Pay counted for plan contributions: up to $360,000.</li><li>All contributions to your account: $72,000, plus catch-up.</li></ul>" },
    { h: "The max-out percentage", html: "<p>The calculator searches for the smallest election, in your plan's increments, that reaches your limit by the final paycheck. If rounding up would hit the limit early and lose match, it rounds down instead.</p>" },
  ],
  sources: [
    { name: "IRS: 401(k) and profit-sharing plan contribution limits (2026)", url: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits" },
    { name: "IRS: Matching contributions help you save more for retirement", url: "https://www.irs.gov/retirement-plans/matching-contributions-help-you-save-more-for-retirement" },
    { name: "Venable: 2026 IRS dollar limits, including the Roth catch-up wage threshold", url: "https://www.venable.com/insights/publications/2025/11/2026-irs-dollar-limits-on-benefits-contributions" },
  ],
  faqs: [
    { q: "What is the 401(k) contribution limit for 2026?", a: "$24,500 in employee deferrals. Workers 50 or older can add an $8,000 catch-up, and those aged 60 to 63 can add $11,250 instead." },
    { q: "Can I lose my employer match by contributing too much?", a: "Yes, if your employer matches each paycheck and doesn't make a year-end true-up. Once you hit the annual limit, your contributions stop for the rest of the year, and the per-paycheck match stops with them." },
    { q: "What is a 401(k) true-up?", a: "A year-end contribution some employers make to bring your match up to what the annual formula would have paid, so front-loading doesn't cost you match. Check your summary plan description." },
    { q: "What does vesting mean for my match?", a: "Vesting is how much of the employer's money you keep if you leave. Your own contributions are always 100% vested; matches can vest immediately, all at once after up to 3 years (cliff), or gradually over up to 6 years." },
  ],
  disclaimer: "Planning estimate only, not tax or investment advice. Your plan document controls the match formula, true-up, eligible pay, and vesting. Limits shown are for 2026.",
};
