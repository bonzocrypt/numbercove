module.exports = {
  id: "moving-cost",
  seoTitle: "Moving Cost Calculator: Rental Truck vs Movers vs Moving Container | NumberCove",
  description: "Compare the real cost of moving with a rental truck, full-service movers, or a portable container: rental, fuel, tow, helpers, tips, protection, lodging, storage, and your time, side by side.",
  h1: "Moving cost calculator: truck vs movers vs container",
  lede: "The truck quote is never the whole bill. Put your quotes in, and this adds fuel, the car trailer, helpers, tips, coverage, nights on the road, and your days, so you can compare the three ways to move on equal terms.",
  appCategory: "FinanceApplication",
  formTitle: "Your move",
  resultTitle: "The cheapest way to move",
  method: [
    { h: "Driving days", html: "<p class=\"formula\">Driving days = ⌈distance ÷ miles you'll drive per day⌉</p><p>Each extra driving day adds a night of lodging, and every travel day adds meals. All three options include your own trip.</p>" },
    { h: "Rental truck", html: "<p class=\"formula\">Truck = rental + per-mile fees + distance ÷ truck mpg × fuel price + car trailer + supplies + protection + helpers + lodging and meals + your time</p><p>Your time counts the driving days plus a day to load and a day to unload.</p>" },
    { h: "Full-service movers", html: "<p class=\"formula\">Movers = quote + tip + full-value protection + boxes + driving your car + lodging and meals + your time</p><p>You still travel, but you don't load or drive a truck, so less of your time is counted.</p>" },
    { h: "Portable container", html: "<p class=\"formula\">Container = quote + storage months × monthly rate + supplies + helpers at both ends + driving your car + lodging and meals + your time</p>" },
  ],
  sources: [
    { name: "FMCSA: Protect Your Move (interstate mover registration and complaints)", url: "https://www.fmcsa.dot.gov/protect-your-move" },
    { name: "FMCSA: Your Rights and Responsibilities When You Move", url: "https://www.fmcsa.dot.gov/protect-your-move/rights-and-responsibilities" },
    { name: "U.S. EIA: Gasoline and diesel fuel update (default fuel price)", url: "https://www.eia.gov/petroleum/gasdiesel/" },
  ],
  faqs: [
    { q: "Is it cheaper to rent a truck or hire movers?", a: "For most long-distance moves, a rental truck has the lowest cash cost, but it uses several days of your time and needs helpers. Once you value your time and add a car trailer, lodging, and fuel, the gap often shrinks, and a container can land in between." },
    { q: "How much fuel does a moving truck use?", a: "Large rental trucks typically get about 6 to 12 miles per gallon depending on size and load. For an 850-mile move at 10 mpg, that's about 85 gallons." },
    { q: "How much should I tip movers?", a: "There's no rule, but many people tip a percentage of the bill or a set amount per mover per day, more for heavy items, stairs, or long days." },
    { q: "What does mover liability coverage actually pay?", a: "Interstate movers must offer full-value protection, or you can choose the lower released value option, which pays no more than 60 cents per pound per item. A 10-pound TV would be covered for only $6 under released value." },
  ],
};
