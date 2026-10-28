module.exports = {
  id: "return-to-office",
  seoTitle: "Return-to-Office Cost Calculator: Commute Costs and the Raise You'd Need | NumberCove",
  description: "What does going back to the office cost? Add fuel, depreciation, tolls, parking, transit, childcare, meals, clothing, and unpaid commute time, then see the raise needed to break even after taxes.",
  h1: "Return-to-office & commute cost calculator",
  lede: "Going in three days a week can quietly cost thousands. Total every expense, see the unpaid hours, and find the pre-tax raise it would take to come out even.",
  appCategory: "FinanceApplication",
  formTitle: "Your commute",
  resultTitle: "What it costs",
  method: [
    { h: "Daily costs", html: "<p>Driving can be figured two ways: fuel (miles ÷ mpg × gas price) plus per-mile maintenance and depreciation, or the IRS business mileage rate of 76¢ a mile for July through December 2026, which also covers insurance and other fixed costs. Tolls, parking, transit, childcare, meals, and other office-day costs are added per day.</p><p class=\"formula\">Annual cost = (daily costs − daily savings) × office days a year + monthly costs × 12</p>" },
    { h: "The raise you'd need", html: "<p>Commuting costs come out of take-home pay and generally aren't deductible for employees, so a raise must cover the tax on the raise too.</p><p class=\"formula\">Raise = annual cost ÷ (1 − combined tax rate)</p>" },
    { h: "Your time", html: "<p>Round-trip minutes × office days gives unpaid hours. They're valued at your salary's hourly rate (salary ÷ 2,080) unless you enter your own figure.</p>" },
  ],
  sources: [
    { name: "IRS: 2026 business standard mileage rate (72.5¢ from January 1)", url: "https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents" },
    { name: "CPA Practice Advisor: IRS raises the business rate to 76¢ for July 1 to December 31, 2026", url: "https://www.cpapracticeadvisor.com/2026/07/16/rising-fuel-costs-prompt-irs-to-raise-standard-mileage-rates-for-rest-of-2026/186784/" },
    { name: "U.S. Energy Information Administration: weekly retail gasoline prices ($4.28 national average, week of October 19, 2026)", url: "https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_nus_w.htm" },
  ],
  faqs: [
    { q: "How much does returning to the office cost?", a: "It depends on distance and extras, but driving 30 miles round trip three days a week with parking and lunch commonly runs several thousand dollars a year before counting your time." },
    { q: "How much of a raise do I need to return to the office?", a: "Divide your annual commuting cost by one minus your combined tax rate. At a 30% tax rate, $5,000 of commuting costs needs about a $7,140 raise." },
    { q: "Can I deduct my commute?", a: "Generally no. Commuting between home and your regular workplace is a personal expense for employees under federal tax rules." },
  ],
};
