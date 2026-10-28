module.exports = {
  id: "social-security",
  seoTitle: "Social Security Claiming Age Calculator: Break-Even Age for 62, 67, and 70 | NumberCove",
  description: "When should you claim Social Security? See your monthly benefit at every age from 62 to 70, the break-even ages between them, and which claiming age pays the most to your planning age.",
  h1: "Social Security claiming-age & break-even calculator",
  lede: "Claim at 62 and get smaller checks sooner, or wait until 70 for checks up to 77% larger. See the age at which waiting pays off and which choice delivers the most over your lifetime.",
  appCategory: "FinanceApplication",
  formTitle: "Your benefit",
  resultTitle: "Your best claiming age",
  method: [
    { h: "Claiming early", html: "<p>Before full retirement age, your benefit is reduced 5/9 of 1% for each of the first 36 months early and 5/12 of 1% for each month beyond that. With a full retirement age of 67, claiming at 62 pays 70% of your full benefit.</p>" },
    { h: "Claiming late", html: "<p>Each month you wait past full retirement age adds 2/3 of 1% (8% a year) until age 70. With a full retirement age of 67, claiming at 70 pays 124%.</p>" },
    { h: "Full retirement age", html: "<p>66 for people born 1943 to 1954, rising by 2 months a year for 1955 to 1959, and 67 for anyone born in 1960 or later.</p>" },
    { h: "Break-even and lifetime value", html: "<p>The break-even age is when total benefits from a later claim catch up with an earlier one. Lifetime value adds every monthly check from the claiming age to your planning age, in today's dollars. A discount rate above 0% counts money received sooner as worth more.</p>" },
  ],
  sources: [
    { name: "Social Security Administration: Early or late retirement (reduction and delayed retirement credit rules)", url: "https://www.ssa.gov/oact/quickcalc/early_late.html" },
    { name: "Social Security Administration: my Social Security account (your full-retirement-age benefit)", url: "https://www.ssa.gov/myaccount/" },
  ],
  faqs: [
    { q: "What is the break-even age for Social Security?", a: "With a full retirement age of 67, waiting from 62 to 70 breaks even at about 80 and a half, ignoring cost-of-living raises and investment returns, which apply to every option alike or depend on your situation. Live longer and waiting pays more." },
    { q: "How much more do I get by waiting until 70?", a: "Each year past full retirement age adds 8%, so someone with a full retirement age of 67 receives 124% of their full benefit at 70, compared with 70% at 62." },
    { q: "Does my spouse affect when I should claim?", a: "Yes. The higher earner's benefit becomes the survivor benefit, so delaying can raise what a surviving spouse receives for life." },
  ],
  disclaimer: "Estimate only. Your benefit depends on your earnings record, and spousal, survivor, earnings-test, tax, and Medicare rules can change the answer. Confirm with the Social Security Administration.",
};
