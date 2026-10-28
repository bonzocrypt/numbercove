module.exports = {
  id: "max-buy-price",
  seoTitle: "Max Buy Price Calculator for Resellers: eBay, Poshmark, Mercari, Whatnot, Etsy | NumberCove",
  description: "Work backward from the sale price to the most you can pay for an item and still hit your ROI, margin, or dollar profit after platform fees, shipping, supplies, returns, sales tax, and your time.",
  h1: "Max buy price calculator for resellers",
  lede: "Know your number before you buy. Work backward from what an item will sell for to the most you can pay and still hit your target after every fee and cost.",
  appCategory: "BusinessApplication",
  formTitle: "The flip",
  resultTitle: "Your max price",
  method: [
    { h: "Working backward", html: "<p>Start with what the buyer pays (item plus any shipping they're charged), subtract platform fees, promoted-listing fees, the shipping label, supplies, a returns allowance, and the value of your time. What's left must cover the item cost and your profit.</p><p class=\"formula\">Net = buyer pays − fees − promotion − label − supplies − returns − time</p>" },
    { h: "Targets", html: "<ul><li><strong>Return on cost:</strong> max cost = net ÷ (1 + ROI).</li><li><strong>Profit margin:</strong> max cost = net − margin × sale price.</li><li><strong>Dollar profit:</strong> max cost = net − target.</li></ul><p>If you pay sales tax when you buy, the max price before tax is max cost ÷ (1 + tax rate).</p>" },
    { h: "Platform fees used", html: "<ul><li><strong>eBay (most categories):</strong> 13.6% of item plus shipping up to $7,500 (2.35% above), plus $0.30 per order of $10 or less or $0.40 above.</li><li><strong>Poshmark:</strong> $2.95 under $15, otherwise 20%.</li><li><strong>Mercari:</strong> 10% of item plus buyer shipping.</li><li><strong>Whatnot:</strong> 8% commission plus 2.9% + $0.30 processing.</li><li><strong>Etsy:</strong> 6.5% transaction fee plus 3% + $0.25 payment processing and a $0.20 listing fee.</li><li><strong>Vinted:</strong> no seller fee.</li></ul><p>Category-specific rates differ; see the <a href=\"marketplace.html\">marketplace payout calculator</a> for category detail, or choose Custom.</p>" },
  ],
  sources: [
    { name: "eBay: Selling fees", url: "https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822" },
    { name: "Etsy: Fees and payments policy", url: "https://www.etsy.com/legal/fees/" },
  ],
  faqs: [
    { q: "What is a good ROI for reselling?", a: "Many resellers aim for at least 2x to 3x their cost (100% to 200% return) on low-priced items to cover time and misses, and accept lower percentage returns on higher-priced items where the dollar profit is larger. Set the target that fits your time and volume." },
    { q: "Should I include my time?", a: "If you're deciding whether a flip is worth doing at all, yes. Enter minutes per item and an hourly value, and the calculator lowers your max buy price accordingly." },
    { q: "How do I estimate the sale price?", a: "Use recent sold listings for the same item and condition, not active asking prices. Plug in a conservative number; the chart shows how your max price changes if it sells for more or less." },
  ],
};
