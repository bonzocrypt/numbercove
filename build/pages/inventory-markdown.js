module.exports = {
  id: "inventory-markdown",
  seoTitle: "Inventory Markdown Calculator: Hold for Full Price, Take the Offer, or Liquidate? | NumberCove",
  description: "For resellers: compare waiting for full price against taking a lower offer now or liquidating, after holding costs, price decline, sell-through odds, fees, and the cost of tied-up cash.",
  h1: "Inventory aging & markdown calculator",
  lede: "Is it better to wait for $100, take $80 now, or liquidate at $60? Compare every option in today's dollars, including what each month of waiting costs you.",
  appCategory: "BusinessApplication",
  formTitle: "Your item",
  resultTitle: "Best move",
  method: [
    { h: "Selling now", html: "<p>A sale you can make today is worth its price less fees and any per-sale cost.</p>" },
    { h: "Waiting at a listed price", html: "<p>Each month the item has the chance you enter of selling. Every month it doesn't sell costs the holding cost, and the price you can get drifts down by the decline rate. Money arriving later is worth less than money today, so each month's proceeds are discounted at your cost of tied-up cash. Whatever hasn't sold by your time limit is liquidated at the floor price, which ages too.</p><p class=\"formula\">Value = Σ (still unsold) × chance × net price(month) ÷ discount − Σ (still unsold) × holding cost ÷ discount + (unsold at limit) × liquidation value</p>" },
    { h: "Sell-through needed to justify waiting", html: "<p>The calculator solves for the monthly sell chance at which waiting for the best listed price exactly matches the best take-it-now option. If your real sell-through is lower, take the offer.</p>" },
    { h: "Estimating your monthly chance", html: "<p>Use your own data: if 3 of 20 similar items sold last month, that's 15%. Marketplace sell-through rates on sold versus active listings are a useful starting point.</p>" },
  ],
  sources: [],
  faqs: [
    { q: "When should I mark down slow-moving inventory?", a: "When the chance of selling at the current price each month is too low to cover holding costs, price decline, and the value of having the cash now. This calculator shows the exact monthly sell-through rate you'd need to justify waiting." },
    { q: "What is holding cost?", a: "Everything it costs to keep an unsold item: storage space, insurance, and the shelf or bin space that could hold faster-moving stock. Enter it per unit per month." },
    { q: "Why discount future sales?", a: "Cash in hand can buy new inventory, pay down debt, or earn interest. A $100 sale six months from now is worth less than $100 today." },
  ],
  disclaimer: "Planning estimate only. Sell-through odds and price trends are assumptions you supply; results change with them.",
};
