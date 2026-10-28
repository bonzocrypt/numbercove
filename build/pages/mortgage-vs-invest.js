module.exports = {
  id: "mortgage-vs-invest",
  seoTitle: "Pay Off Mortgage Early or Invest? Calculator with Break-Even Return | NumberCove",
  description: "Should you make extra mortgage payments or invest the money? Compare net worth over time, interest saved, and the investment return you'd need for investing to win, with optional mortgage interest deduction and tax drag.",
  h1: "Pay off the mortgage early or invest?",
  lede: "Extra payments earn a guaranteed return equal to your mortgage rate. Investing might earn more. See exactly where the line is with your numbers.",
  appCategory: "FinanceApplication",
  formTitle: "Your mortgage",
  resultTitle: "The answer",
  method: [
    { h: "Two strategies", html: "<ul><li><strong>Pay off early:</strong> add the extra amount to every payment until the loan is gone, then invest the full payment plus the extra for the rest of the original term.</li><li><strong>Invest the extra:</strong> keep the regular schedule and invest the extra every month.</li></ul><p>Both end at the original payoff date with no mortgage, so the comparison is the investment balance.</p>" },
    { h: "Returns and taxes", html: "<p>The investment return is an annual rate converted to monthly. Tax drag lowers it for taxable accounts. If you itemize, the interest deduction's tax savings are invested in both strategies.</p>" },
    { h: "Break-even return", html: "<p>The calculator searches for the return at which both strategies end with the same net worth. Because a mortgage rate compounds monthly, the break-even annual return is slightly above the stated rate (a 6% mortgage equals about 6.17% a year).</p>" },
  ],
  sources: [
    { name: "IRS Publication 936: Home mortgage interest deduction", url: "https://www.irs.gov/publications/p936" },
  ],
  faqs: [
    { q: "Is it better to pay off my mortgage early or invest?", a: "If your investments earn more than your mortgage rate after taxes, investing builds more wealth on average. Paying off the mortgage is a guaranteed return with no market risk. The calculator shows the break-even return for your loan." },
    { q: "What is the break-even return?", a: "The annual investment return at which investing the extra and paying off the loan early leave you with the same net worth at the original payoff date." },
    { q: "Does the mortgage interest deduction change the answer?", a: "Only if you itemize deductions. It lowers your effective mortgage rate, which makes investing more attractive." },
  ],
};
