const E = require("../js/options-engine.js");
let fails = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + ": got " + got.toFixed(6) + " want " + want + " tol " + tol);
}

// Black-Scholes textbook values (S=100,K=100,T=1,r=5%,sigma=20%)
check("BS call", E.bsPrice("call", 100, 100, 1, 0.05, 0, 0.2), 10.450584, 1e-5);
check("BS put", E.bsPrice("put", 100, 100, 1, 0.05, 0, 0.2), 5.573526, 1e-5);
const g = E.bsGreeks("call", 100, 100, 1, 0.05, 0, 0.2);
check("BS call delta", g.delta, 0.636831, 1e-5);
check("BS gamma", g.gamma, 0.018762, 1e-5);
check("BS vega per pt", g.vega, 0.375240, 1e-5);
check("BS call theta/day", g.theta, -6.414028 / 365, 1e-5);
// Hull example 15.6: S=42,K=40,r=10%,sigma=20%,T=0.5
check("Hull call", E.bsPrice("call", 42, 40, 0.5, 0.1, 0, 0.2), 4.7594, 1e-4);
check("Hull put", E.bsPrice("put", 42, 40, 0.5, 0.1, 0, 0.2), 0.8086, 1e-4);
// Put-call parity with dividends
const c = E.bsPrice("call", 100, 95, 0.75, 0.04, 0.02, 0.35), p = E.bsPrice("put", 100, 95, 0.75, 0.04, 0.02, 0.35);
check("parity", c - p, 100 * Math.exp(-0.02 * 0.75) - 95 * Math.exp(-0.04 * 0.75), 1e-10);

// European LR tree converges to BS
check("LR euro call vs BS", E.lrPrice("call", 100, 100, 1, 0.05, 0, 0.2, 201, false), 10.450584, 2e-4);
check("LR euro put vs BS", E.lrPrice("put", 100, 110, 0.5, 0.05, 0.02, 0.3, 201, false), E.bsPrice("put", 100, 110, 0.5, 0.05, 0.02, 0.3), 2e-4);

// Independent reference: CRR tree, 6000 steps, averaged with 6001 steps
function crr(type,S,K,T,r,q,sig,n,amer){const dt=T/n,u=Math.exp(sig*Math.sqrt(dt)),d=1/u,p=(Math.exp((r-q)*dt)-d)/(u-d),disc=Math.exp(-r*dt);
 const v=new Float64Array(n+1);for(let i=0;i<=n;i++){const s=S*Math.pow(u,i)*Math.pow(d,n-i);v[i]=type==="put"?Math.max(K-s,0):Math.max(s-K,0);}
 for(let st=n-1;st>=0;st--){for(let j=0;j<=st;j++){let c=disc*(p*v[j+1]+(1-p)*v[j]);if(amer){const s=S*Math.pow(u,j)*Math.pow(d,st-j);const e=type==="put"?K-s:s-K;if(e>c)c=e;}v[j]=c;}}return v[0];}
const ref=(t,S,K,T,r,q,sig)=>(crr(t,S,K,T,r,q,sig,6000,true)+crr(t,S,K,T,r,q,sig,6001,true))/2;
const cases=[["put",36,40,1,0.06,0,0.2,4.478],["put",36,40,2,0.06,0,0.2,4.840],["put",40,40,1,0.06,0,0.2,2.314],["put",44,40,2,0.06,0,0.4,5.647],["put",38,40,1,0.06,0,0.4,6.148],["call",100,90,1,0.03,0.08,0.25,null],["put",100,100,0.12,0.045,0.015,0.6,null],["put",100,120,0.5,0.05,0,0.3,null],["put",100,95,0.02,0.05,0,0.4,null]];
for(const c of cases){const R=ref(c[0],c[1],c[2],c[3],c[4],c[5],c[6]);
 console.log("  ref CRR="+R.toFixed(4)+(c[7]?"  (Longstaff-Schwartz FD table: "+c[7]+")":""));
 check("Amer201 "+c.slice(0,7).join(","),E.americanPrice(c[0],c[1],c[2],c[3],c[4],c[5],c[6],201),R,1e-3);
 check("Amer101 "+c.slice(0,7).join(","),E.americanPrice(c[0],c[1],c[2],c[3],c[4],c[5],c[6],101),R,1e-3);}
// American call with dividend >= European, and converges with steps
const ac = E.lrPrice("call", 100, 90, 1, 0.03, 0.08, 0.25, 201, true);
const ec = E.bsPrice("call", 100, 90, 1, 0.03, 0.08, 0.25);
check("Amer call div >= Euro (diff>0)", ac - ec > 0 ? 1 : 0, 1, 0);
// Router: american call no div uses BS exactly
const o = { type: "call", S: 100, K: 100, T: 1, r: 0.05, q: 0, sigma: 0.2, style: "american" };
check("router amer call q=0 = BS", E.price(o), 10.450584, 1e-5);
// American Greeks vs euro-ish sanity: american put delta between -1 and 0, gamma > 0, vega > 0
const ag = E.greeks({ type: "put", S: 40, K: 40, T: 1, r: 0.06, q: 0, sigma: 0.2, style: "american" });
console.log("Amer put greeks", ag);
check("amer put delta range", ag.delta < 0 && ag.delta > -1 ? 1 : 0, 1, 0);
check("amer put gamma>0", ag.gamma > 0 ? 1 : 0, 1, 0);
check("amer put theta<0", ag.theta < 0 ? 1 : 0, 1, 0);
// FD greeks of european tree match closed form roughly: compare american put deep OTM (little early exercise) to BS
const otm = { type: "put", S: 100, K: 70, T: 0.25, r: 0.04, q: 0, sigma: 0.3, style: "american" };
const otmG = E.greeks(otm), otmB = E.bsGreeks("put", 100, 70, 0.25, 0.04, 0, 0.3);
check("OTM amer put delta ~ BS", otmG.delta, otmB.delta, 2e-3);
check("OTM amer put vega ~ BS", otmG.vega, otmB.vega, 2e-3);
check("OTM amer put theta ~ BS", otmG.theta, otmB.theta, 1e-3);

// Implied vol round trips
const euro = { type: "call", S: 100, K: 105, T: 45 / 365, r: 0.04, q: 0.01, style: "european" };
const target = E.price(E.assign(euro, { sigma: 0.32 }));
check("IV euro roundtrip", E.impliedVol(target, euro).iv, 0.32, 1e-5);
const amer = { type: "put", S: 36, K: 40, T: 1, r: 0.06, q: 0, style: "american" };
check("IV low-vol tree finite", Number.isFinite(E.lrPrice("put",36,40,1,0.06,0,0.001,201,true))?1:0, 1, 0);
check("IV amer ~0.2", E.impliedVol(E.price(E.assign(amer, { sigma: 0.2 })), amer).iv, 0.2, 1e-5);
const bad = E.impliedVol(3.5, amer);
console.log("IV below intrinsic ->", bad.error);
check("IV below intrinsic errors", bad.error ? 1 : 0, 1, 0);

// Probability of profit: long call, breakeven K+premium, POP = P(S_T > BE)
const S = 100, K = 105, T = 45 / 365, r = 0.04, q = 0, sig = 0.32, prem = 2.45;
const pnl = (x) => Math.max(x - K, 0) - prem;
const grid = [];
for (let i = 0; i <= 400; i++) grid.push(S * Math.exp(-8 * sig * Math.sqrt(T) + (16 * sig * Math.sqrt(T) * i) / 400));
const reg = E.profitRegions(pnl, grid);
check("BE long call", reg.crossings[0], 107.45, 1e-6);
check("POP long call", E.probabilityOfProfit(reg, S, T, r - q, sig), E.probAbove(S, 107.45, T, r - q, sig), 1e-9);
// Short strangle: profit between two breakevens
const pnl2 = (x) => 4 - Math.max(x - 110, 0) - Math.max(90 - x, 0);
const reg2 = E.profitRegions(pnl2, grid);
check("strangle BEs", reg2.crossings.length, 2, 0);
check("strangle POP", E.probabilityOfProfit(reg2, S, T, r, sig), E.probAbove(S, 86, T, r, sig) - E.probAbove(S, 114, T, r, sig), 1e-9);

// Speed
let t0 = Date.now();
for (let i = 0; i < 1000; i++) E.lrPrice("put", 100, 100, 0.5, 0.05, 0.01, 0.3, 101, true);
console.log("1000 N=101 trees ms:", Date.now() - t0);
t0 = Date.now();
for (let i = 0; i < 100; i++) E.greeks({ type: "put", S: 100, K: 100, T: 0.5, r: 0.05, q: 0.01, sigma: 0.3, style: "american" });
console.log("100 american greek sets (N=201) ms:", Date.now() - t0);

console.log(fails ? fails + " FAILURES" : "ALL PASS");
process.exit(fails ? 1 : 0);
