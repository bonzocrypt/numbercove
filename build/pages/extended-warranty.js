module.exports = {
  id: "extended-warranty",
  seoTitle: "Extended Warranty Calculator: Is a Protection Plan Worth It? | NumberCove",
  description: "Is the extended warranty worth it? Compare the plan's price with the expected cost of repairs, deductibles, exclusions, and your credit card's free coverage, and find the repair odds where it breaks even.",
  h1: "Extended warranty calculator: buy the plan or self-insure?",
  lede: "Checkout pages push protection plans hard because they're profitable. Put in the price, the deductible, and an honest chance of a repair, and see whether the plan beats setting the money aside.",
  appCategory: "FinanceApplication",
  formTitle: "The product and the plan",
  resultTitle: "Is it worth it?",
  method: [
    { h: "Expected cost of self-insuring", html: "<p>Without a plan, you pay for any repair yourself. A repair never costs more than replacing the product, so the repair cost is capped at the price.</p><p class=\"formula\">Self-insure = chance of a repair × repairs per failure × repair cost</p>" },
    { h: "Expected cost with the plan", html: "<p>With a plan you pay its price up front, then the deductible on covered repairs. Failures the plan excludes are still on you. If your credit card already extends the manufacturer's warranty, that part of the term was free anyway, so the plan adds nothing there.</p><p class=\"formula\">With plan = price + chance × repairs × [card share × excluded × repair + (1 − card share) × (covered × deductible + excluded × repair)]</p>" },
    { h: "Break-even repair chance", html: "<p>The plan pays off on average only when the chance of a repair is at least:</p><p class=\"formula\">Break-even chance = plan price ÷ [repairs × (1 − card share) × (1 − excluded) × (repair − deductible)]</p><p>If that number is far above any realistic failure rate, the plan is priced for the seller's profit, not your protection.</p>" },
    { h: "When a plan can still make sense", html: "<p>Averages assume you can absorb an unlucky repair. If one surprise bill would cause real hardship and you have no emergency fund, paying a premium to cap the worst case can be a reasonable choice. The calculator shows both the expected and the worst-case cost so you can weigh that.</p>" },
  ],
  sources: [
    { name: "Federal Trade Commission: Warranties and service contracts", url: "https://consumer.ftc.gov/articles/warranties" },
    { name: "FTC: Businessperson's Guide to Federal Warranty Law (Magnuson-Moss)", url: "https://www.ftc.gov/business-guidance/resources/businesspersons-guide-federal-warranty-law" },
  ],
  faqs: [
    { q: "Are extended warranties ever worth it?", a: "Occasionally: on expensive, failure-prone items with a low deductible, or when a repair bill would be a financial emergency. For most electronics and appliances, the plan's price is well above the expected cost of repairs, which is why retailers push them." },
    { q: "What's the difference between a warranty and a service contract?", a: "A warranty comes with the product at no extra charge. An \"extended warranty\" sold separately is legally a service contract, which may be run by a third party and has its own exclusions, deductibles, and claim process." },
    { q: "Does my credit card already cover this?", a: "Many credit cards extend the manufacturer's warranty, often by one year, when you buy with the card. Check your card's benefits guide and enter the extension under More detail; it reduces the value of a store plan." },
    { q: "How do I estimate the chance of a repair?", a: "Use reliability surveys for the product category and brand, the manufacturer's warranty length, and your own usage. Most products that survive the manufacturer's warranty have a modest failure rate over the next few years." },
  ],
  disclaimer: "Estimates for planning only. Read the plan's terms for coverage, exclusions, and claim limits.",
};
