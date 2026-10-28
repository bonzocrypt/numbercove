module.exports = {
  id: "repair-or-replace",
  seoTitle: "Repair or Replace Appliance Calculator: Is It Worth Fixing? | NumberCove",
  description: "Should you repair or replace your refrigerator, washer, dishwasher, water heater, furnace, or AC? Compare the yearly cost of each, including energy savings, and see the most a repair is worth at every age.",
  h1: "Repair or replace calculator for appliances",
  lede: "The 50% rule is a start, but it ignores age, energy use, and the chance the repair holds. This compares the true yearly cost of fixing versus replacing, and charts the most a repair is worth as the appliance ages.",
  appCategory: "FinanceApplication",
  formTitle: "Your appliance",
  resultTitle: "Repair or replace?",
  method: [
    { h: "Yearly cost of replacing", html: "<p>A new unit's price, plus install and haul-away less rebates and scrap value, is spread over its lifespan with an interest rate (the capital recovery factor), then its yearly energy cost is added.</p><p class=\"formula\">Replace per year = net price × r ÷ (1 − (1 + r)<sup>−life</sup>) + new kWh × price</p>" },
    { h: "Yearly cost of repairing", html: "<p>A repair buys the remaining life of the appliance if it holds. If it doesn't, we assume the unit fails again within about six months. The expected life bought is:</p><p class=\"formula\">Life after repair = chance it lasts × years left + (1 − chance) × 0.5</p><p>The repair is spread over that life the same way, plus the old unit's energy use and any extra upkeep.</p>" },
    { h: "Most a repair is worth", html: "<p>The break-even repair is the amount that makes both yearly costs equal. Any quote below it favors repairing. The chart repeats this at every age, which is why the line falls: an older unit has fewer years left to spread a repair over.</p>" },
    { h: "Typical lifespans", html: "<p>Presets use midpoints of InterNACHI's estimated life expectancy ranges and typical installed prices. Your model, usage, water quality, and maintenance can move them a lot, so edit them freely.</p>" },
  ],
  sources: [
    { name: "InterNACHI: Estimated Life Expectancy Chart for homes and appliances", url: "https://www.nachi.org/life-expectancy.htm" },
    { name: "U.S. EIA: Electric Power Monthly, average residential electricity price", url: "https://www.eia.gov/electricity/monthly/" },
    { name: "ENERGY STAR: Product finder for energy use of new appliances", url: "https://www.energystar.gov/productfinder/" },
  ],
  faqs: [
    { q: "What is the 50% rule for appliance repair?", a: "If a repair costs more than half the price of a new appliance, replace it. It's a quick screen, but it ignores how many years the appliance has left and how much a new one would save on energy. The calculator shows the 50% rule next to the fuller answer." },
    { q: "How long do appliances last?", a: "Roughly: dishwashers about 9 years, washers 10, refrigerators 10 to 13, dryers about 13, ranges 13 to 15, tank water heaters 8 to 10, furnaces 15 to 25, and central air conditioners 10 to 12. Use the preset as a starting point and adjust for your model." },
    { q: "Does a new appliance's energy savings matter?", a: "For refrigerators, freezers, HVAC, and water heaters, it can. Compare the kWh on the yellow EnergyGuide label for each unit. For small appliances, energy savings rarely change the answer." },
    { q: "Should I repair an appliance that's under 5 years old?", a: "Usually yes. With most of its life ahead, a repair is spread over many years, so even a sizable quote can be worth paying. Check whether the manufacturer's or a credit card's extended warranty still covers it." },
  ],
  disclaimer: "Estimates for planning only. Lifespans and prices vary by model and installer.",
};
