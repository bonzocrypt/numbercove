module.exports = {
  id: "lease-vs-buy",
  seoTitle: "Lease vs Buy Car Calculator: Payments, Money Factor, and True Cost | NumberCove",
  description: "Should you lease or buy a car? Calculate the lease payment from MSRP, residual, and money factor, compare it with a loan, and see the true cost over the lease term and over the years you'd keep the car.",
  h1: "Lease vs buy car calculator",
  lede: "A lease payment is lower, but you own nothing at the end. This calculates the lease the way the dealer does, compares it with financing, and shows the real cost after counting what the car is worth, over the lease and over the years you'd keep it.",
  appCategory: "FinanceApplication",
  formTitle: "The car and the offers",
  resultTitle: "Lease or buy?",
  method: [
    { h: "Lease payment", html: "<p>A lease charges for the value the car loses while you drive it, plus a finance charge set by the money factor.</p><p class=\"formula\">Adjusted cap cost = negotiated price + acquisition fee − down payment</p><p class=\"formula\">Residual = MSRP × residual %</p><p class=\"formula\">Payment = (adjusted cap − residual) ÷ months + (adjusted cap + residual) × money factor, plus sales tax on the payment</p><p>Money factor × 2,400 gives the equivalent APR.</p>" },
    { h: "Cost over the lease term", html: "<p class=\"formula\">Lease cost = down payment (with tax) + payments + disposition fee + extra-mile charges</p><p class=\"formula\">Buy cost = down payment + loan payments made − (car's value − loan balance left)</p><p>The car's value when the lease would end defaults to the residual value, the lender's own estimate.</p>" },
    { h: "Keeping it longer", html: "<p>Buying usually wins the longer you keep the car, because payments stop when the loan is paid off. The chart compares buying and keeping with leasing continuously at the same terms, with the car losing value at the same yearly rate and repairs added after the warranty ends.</p>" },
  ],
  sources: [
    { name: "Federal Trade Commission: Financing or leasing a car", url: "https://consumer.ftc.gov/articles/financing-or-leasing-car" },
  ],
  faqs: [
    { q: "Is it better to lease or buy a car?", a: "Buying and keeping a car for many years is usually cheapest, because you stop making payments once the loan is paid off. Leasing can make sense if you want a new car every few years, drive predictable miles, or get a subsidized lease with a high residual and low money factor." },
    { q: "How do I convert a money factor to an interest rate?", a: "Multiply by 2,400. A money factor of 0.0025 is about 6% APR. Ask the dealer for the money factor and compare it with the lender's base rate; dealers can mark it up." },
    { q: "What is a good residual value?", a: "Higher is better for a lease, since you pay only for the drop from your price to the residual. Many 36-month leases have residuals in the 50% to 60% range of MSRP, and the lender sets it." },
    { q: "Should I put money down on a lease?", a: "Usually keep it small. A cap cost reduction lowers your payment, but if the car is totaled or stolen early, that down payment is typically lost, even with gap coverage." },
  ],
  disclaimer: "Estimates for planning only. Tax rules for leases vary by state; confirm figures on the dealer's written offer.",
};
