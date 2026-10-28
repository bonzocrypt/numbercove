module.exports = {
  id: "buy-rent-hire",
  seoTitle: "Buy, Rent, or Hire Calculator: Buy the Tool or Hire a Pro? | NumberCove",
  description: "Should you buy the tool, rent it, or hire a pro? Compare total cost including your time, materials, the chance of redoing it, resale value, and future projects, and see how many uses make buying worth it.",
  h1: "Buy, rent, or hire calculator",
  lede: "A $450 tool seems cheaper than a $1,200 quote until you count your weekend and the chance of doing it twice. Compare all three paths honestly, including what the tool is worth on the next project.",
  appCategory: "FinanceApplication",
  formTitle: "The project",
  resultTitle: "The cheapest path",
  method: [
    { h: "Doing it yourself", html: "<p>Buying and renting both mean you do the work, so both carry your materials, your time, and the expected cost of redoing part of it.</p><p class=\"formula\">DIY per project = materials + hours × value of your time + redo chance × (redo cost + redo hours × value of your time)</p>" },
    { h: "Buy vs rent", html: "<p class=\"formula\">Buy = tool price − resale value + projects × (DIY + consumables) + upkeep on extra projects</p><p class=\"formula\">Rent = projects × (daily rate × days + consumables + pickup cost + DIY)</p><p>Buying beats renting once the rental you avoid on each extra use covers the tool's net cost.</p>" },
    { h: "Hiring", html: "<p class=\"formula\">Hire = projects × (quote + materials if not included)</p><p>Hiring costs none of your time and carries no redo risk to you, since a reputable pro fixes their own mistakes.</p>" },
  ],
  sources: [
    { name: "U.S. Bureau of Labor Statistics: Occupational Employment and Wage Statistics (typical trade wages)", url: "https://www.bls.gov/oes/" },
  ],
  faqs: [
    { q: "How do I value my own time?", a: "Use what you'd actually give up: overtime or freelance pay if you'd otherwise earn it, or a lower figure if it's a free weekend you'd enjoy spending on the project. Set it to $0 to compare cash only." },
    { q: "When is buying a tool worth it?", a: "When you'll use it enough times that the rentals you avoid add up to more than the tool's price minus what you could resell it for. The calculator shows that number of uses." },
    { q: "Should I count the risk of messing it up?", a: "Yes, for unfamiliar or high-stakes jobs like tile, drywall finishing, or plumbing. Enter a realistic chance of redoing part of it and what that would cost. It's often what tips the decision toward hiring." },
  ],
};
