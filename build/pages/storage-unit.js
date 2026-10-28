module.exports = {
  id: "storage-unit",
  seoTitle: "Storage Unit Calculator: Keep Paying, Sell, or Rebuy Later? | NumberCove",
  description: "Should you keep your storage unit? Compare rent and rent increases against what your things sell for today and what replacing them later would cost. Find the month storage stops making sense.",
  h1: "Storage unit calculator: keep, sell, or rebuy later?",
  lede: "Rent adds up quietly. Compare the full cost of keeping your things in storage with selling them now and rebuying what you need later, and see the exact month the math flips.",
  appCategory: "FinanceApplication",
  formTitle: "Your storage unit",
  resultTitle: "The answer",
  method: [
    { h: "Keeping it", html: "<p>Rent is charged every month and rises by your annual increase every 12 months. Insurance or protection fees are added monthly, and moving everything out when you need it is added once.</p><p class=\"formula\">Cost to keep (month m) = Σ rent + Σ insurance + move-out cost</p>" },
    { h: "Selling now and rebuying later", html: "<p>Selling today nets the resale value less selling costs and haul-away fees. That cash can earn a return while you wait. When you need the items again, you rebuy only what you'd actually replace, at today's price grown by inflation.</p><p class=\"formula\">Cost to sell & rebuy (month m) = replacement × (1 + inflation)^(m/12) − proceeds × (1 + return)^(m/12)</p>" },
    { h: "The two break-even points", html: "<ul><li><strong>Selling and rebuying wins after:</strong> the first month the cost to keep exceeds the cost to sell and rebuy.</li><li><strong>Storage passes replacement cost:</strong> the first month total rent paid exceeds what it would cost to buy everything new at that time.</li></ul>" },
    { h: "What to leave out", html: "<p>Irreplaceable and sentimental items don't belong in this math. Take them home or into a much smaller unit, and run the numbers on what's left. Many people find a smaller unit for the few things that matter changes the answer.</p>" },
  ],
  sources: [
    { name: "U.S. Bureau of Labor Statistics: Consumer Price Index (default replacement inflation)", url: "https://www.bls.gov/cpi/" }
  ],
  faqs: [
    { q: "When is a storage unit not worth it?", a: "When the rent you'll pay before you need the items back is more than the cost to rebuy them, after counting what you'd get by selling now. For most household goods stored more than a year or two, that point comes sooner than people expect, especially with annual rent increases." },
    { q: "How much do storage units raise rent?", a: "Increases vary by facility and market, and many raise rent on existing tenants periodically. Check your own rate history and enter your actual annual increase; even a few percent a year compounds over a long stay." },
    { q: "What should I count as replacement cost?", a: "Only what you would actually buy again, at the quality you'd choose then, not the full original value of everything in the unit." },
    { q: "Does this include sentimental items?", a: "No. Remove irreplaceable items from the calculation and decide separately how to keep them." },
  ],
};
