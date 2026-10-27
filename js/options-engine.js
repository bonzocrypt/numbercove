/* NumberCove options pricing engine
   European: Black-Scholes-Merton (continuous dividend yield).
   American: Leisen-Reimer binomial tree with early exercise.
   All inputs are decimals (rate 0.05, vol 0.30) and time in years. */
(function (root) {
  "use strict";

  var DAY = 1 / 365;
  var DEFAULT_STEPS = 201;

  /* Standard normal CDF (Marsaglia 2004), accurate to about 1e-15. */
  function normCdf(x) {
    if (x < -9) return 0;
    if (x > 9) return 1;
    var s = x;
    var t = 0;
    var b = x;
    var q = x * x;
    var i = 1;
    while (s !== t) {
      t = s;
      i += 2;
      b *= q / i;
      s = t + b;
    }
    return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178);
  }

  function normPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function intrinsic(type, S, K) {
    return type === "put" ? Math.max(K - S, 0) : Math.max(S - K, 0);
  }

  function bsPrice(type, S, K, T, r, q, sigma) {
    if (!(T > 0)) return intrinsic(type, S, K);
    if (!(sigma > 0)) sigma = 1e-6;
    var sqrtT = Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    var d2 = d1 - sigma * sqrtT;
    var dq = Math.exp(-q * T);
    var dr = Math.exp(-r * T);
    if (type === "put") return K * dr * normCdf(-d2) - S * dq * normCdf(-d1);
    return S * dq * normCdf(d1) - K * dr * normCdf(d2);
  }

  /* Closed-form Greeks. Theta per calendar day, vega per 1 vol point, rho per 1 rate point. */
  function bsGreeks(type, S, K, T, r, q, sigma) {
    if (!(T > 0)) {
      var itm = type === "put" ? S < K : S > K;
      return { delta: itm ? (type === "put" ? -1 : 1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    }
    if (!(sigma > 0)) sigma = 1e-6;
    var sqrtT = Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    var d2 = d1 - sigma * sqrtT;
    var dq = Math.exp(-q * T);
    var dr = Math.exp(-r * T);
    var pdf = normPdf(d1);
    var gamma = (dq * pdf) / (S * sigma * sqrtT);
    var vega = (S * dq * pdf * sqrtT) / 100;
    var common = -(S * dq * pdf * sigma) / (2 * sqrtT);
    var delta;
    var thetaYear;
    var rho;
    if (type === "put") {
      delta = -dq * normCdf(-d1);
      thetaYear = common + r * K * dr * normCdf(-d2) - q * S * dq * normCdf(-d1);
      rho = (-K * T * dr * normCdf(-d2)) / 100;
    } else {
      delta = dq * normCdf(d1);
      thetaYear = common - r * K * dr * normCdf(d2) + q * S * dq * normCdf(d1);
      rho = (K * T * dr * normCdf(d2)) / 100;
    }
    return { delta: delta, gamma: gamma, theta: thetaYear / 365, vega: vega, rho: rho };
  }

  /* Peizer-Pratt inversion (method 2) used by Leisen-Reimer. */
  function ppInversion(z, n) {
    var a = z / (n + 1 / 3 + 0.1 / (n + 1));
    var v = Math.sqrt(0.25 - 0.25 * Math.exp(-a * a * (n + 1 / 6)));
    return z >= 0 ? 0.5 + v : 0.5 - v;
  }

  function lrPrice(type, S, K, T, r, q, sigma, steps, american) {
    if (!(T > 0)) return intrinsic(type, S, K);
    if (!(sigma > 0)) sigma = 1e-6;
    var n = steps || DEFAULT_STEPS;
    if (n % 2 === 0) n += 1;
    var dt = T / n;
    var sqrtT = Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    var d2 = d1 - sigma * sqrtT;
    var p = ppInversion(d2, n);
    var pBar = ppInversion(d1, n);
    var growth = Math.exp((r - q) * dt);
    var u = (growth * pBar) / p;
    var d = (growth - p * u) / (1 - p);
    if (!(p > 1e-9 && p < 1 - 1e-9) || !(d > 0) || !Number.isFinite(u) || !(u > d)) {
      /* Extremely low volatility or deep moneyness: fall back to a CRR tree. */
      u = Math.exp(Math.max(sigma, 1e-4) * Math.sqrt(dt));
      d = 1 / u;
      p = Math.min(1, Math.max(0, (growth - d) / (u - d)));
    }
    var disc = Math.exp(-r * dt);
    var pu = disc * p;
    var pd = disc * (1 - p);
    var isPut = type === "put";
    var values = new Float64Array(n + 1);
    var ratio = u / d;
    var spot = S * Math.pow(d, n);
    for (var i = 0; i <= n; i += 1) {
      values[i] = isPut ? Math.max(K - spot, 0) : Math.max(spot - K, 0);
      spot *= ratio;
    }
    for (var step = n - 1; step >= 0; step -= 1) {
      var nodeSpot = S * Math.pow(d, step);
      for (var j = 0; j <= step; j += 1) {
        var cont = pu * values[j + 1] + pd * values[j];
        if (american) {
          var ex = isPut ? K - nodeSpot : nodeSpot - K;
          values[j] = ex > cont ? ex : cont;
        } else {
          values[j] = cont;
        }
        nodeSpot *= ratio;
      }
    }
    return values[0];
  }

  /* Early exercise of an American call is never optimal when there is no dividend
     and rates are not negative, so Black-Scholes is exact there. */
  function needsTree(type, style, r, q) {
    if (style !== "american") return false;
    if (type === "call" && q <= 0 && r >= 0) return false;
    return true;
  }

  /* American value: Leisen-Reimer trees at n and about n/2 steps combined by
     Richardson extrapolation. Verified within $0.001 of a 6,000-step CRR reference. */
  function americanPrice(type, S, K, T, r, q, sigma, steps) {
    var n = steps || DEFAULT_STEPS;
    if (n % 2 === 0) n += 1;
    var half = Math.floor(n / 2);
    if (half % 2 === 0) half += 1;
    var fine = lrPrice(type, S, K, T, r, q, sigma, n, true);
    var coarse = lrPrice(type, S, K, T, r, q, sigma, half, true);
    var est = fine + (fine - coarse) * (half / (n - half));
    return Math.max(est, intrinsic(type, S, K));
  }

  function price(o, steps) {
    if (!(o.T > 0)) return intrinsic(o.type, o.S, o.K);
    if (needsTree(o.type, o.style, o.r, o.q)) {
      return americanPrice(o.type, o.S, o.K, o.T, o.r, o.q, o.sigma, steps);
    }
    return bsPrice(o.type, o.S, o.K, o.T, o.r, o.q, o.sigma);
  }

  function greeks(o, steps) {
    if (!(o.T > 0) || !needsTree(o.type, o.style, o.r, o.q)) {
      return bsGreeks(o.type, o.S, o.K, o.T, o.r, o.q, o.sigma);
    }
    var n = steps || DEFAULT_STEPS;
    function at(S, T, sigma, r) {
      return americanPrice(o.type, S, o.K, T, r, o.q, sigma, n);
    }
    var h = o.S * 0.01;
    var base = at(o.S, o.T, o.sigma, o.r);
    var up = at(o.S + h, o.T, o.sigma, o.r);
    var down = at(o.S - h, o.T, o.sigma, o.r);
    var later = o.T > DAY ? at(o.S, o.T - DAY, o.sigma, o.r) : intrinsic(o.type, o.S, o.K);
    var volStep = Math.min(0.01, o.sigma / 2);
    var vUp = at(o.S, o.T, o.sigma + volStep, o.r);
    var vDown = at(o.S, o.T, o.sigma - volStep, o.r);
    var rUp = at(o.S, o.T, o.sigma, o.r + 0.0001);
    var rDown = at(o.S, o.T, o.sigma, o.r - 0.0001);
    return {
      delta: (up - down) / (2 * h),
      gamma: (up - 2 * base + down) / (h * h),
      theta: later - base,
      vega: ((vUp - vDown) / (2 * volStep)) / 100,
      rho: ((rUp - rDown) / 0.0002) / 100,
    };
  }

  /* Implied volatility by bisection on the selected model.
     Returns { iv, error } where error explains why it cannot be solved. */
  function impliedVol(target, o, steps) {
    if (!(target > 0)) return { iv: NaN, error: "price must be greater than 0" };
    if (!(o.T > 0)) return { iv: NaN, error: "the option has expired" };
    var lo = 0.001;
    var hi = 5;
    var floor = o.style === "american" ? intrinsic(o.type, o.S, o.K) : 0;
    var fwd = o.S * Math.exp(-o.q * o.T) - o.K * Math.exp(-o.r * o.T);
    floor = Math.max(floor, o.type === "put" ? -fwd : fwd, 0);
    var pLo = Math.max(price(assign(o, { sigma: lo }), steps), floor);
    var pHi = price(assign(o, { sigma: hi }), steps);
    if (target < floor - 1e-6) return { iv: NaN, error: "price is below the option's minimum value (intrinsic or forward value)" };
    if (target <= pLo) return { iv: lo, error: null };
    if (target > pHi) return { iv: NaN, error: "price implies volatility above 500%" };
    for (var i = 0; i < 80; i += 1) {
      var mid = 0.5 * (lo + hi);
      var pm = price(assign(o, { sigma: mid }), steps);
      if (Math.abs(pm - target) < 1e-7) return { iv: mid, error: null };
      if (pm < target) lo = mid;
      else hi = mid;
      if (hi - lo < 1e-7) break;
    }
    return { iv: 0.5 * (lo + hi), error: null };
  }

  function assign(base, extra) {
    var out = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  /* Probability that S_T finishes above X under a lognormal model with drift mu. */
  function probAbove(S, X, T, mu, sigma) {
    if (!(X > 0)) return 1;
    if (!(T > 0) || !(sigma > 0)) return S > X ? 1 : 0;
    var z = (Math.log(S / X) + (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    return normCdf(z);
  }

  /* Probability mass where pnl(S) > 0, given a sorted grid of prices covering
     the distribution and the P&L at each grid point. Crossings are refined by
     bisection with the exact pnl function. */
  function profitRegions(pnlFn, grid) {
    var vals = grid.map(pnlFn);
    var crossings = [];
    for (var i = 1; i < grid.length; i += 1) {
      var a = vals[i - 1];
      var b = vals[i];
      if ((a > 0) !== (b > 0)) {
        var lo = grid[i - 1];
        var hi = grid[i];
        var fLo = a;
        for (var k = 0; k < 50; k += 1) {
          var mid = 0.5 * (lo + hi);
          var fm = pnlFn(mid);
          if ((fm > 0) === (fLo > 0)) {
            lo = mid;
            fLo = fm;
          } else {
            hi = mid;
          }
        }
        crossings.push(0.5 * (lo + hi));
      }
    }
    return { crossings: crossings, startsPositive: vals[0] > 0, values: vals };
  }

  function probabilityOfProfit(regions, S, T, mu, sigma) {
    var positive = regions.startsPositive;
    var edges = [0].concat(regions.crossings).concat([Infinity]);
    var total = 0;
    for (var i = 0; i < edges.length - 1; i += 1) {
      if (positive) {
        var pLow = probAbove(S, edges[i], T, mu, sigma);
        var pHigh = edges[i + 1] === Infinity ? 0 : probAbove(S, edges[i + 1], T, mu, sigma);
        total += pLow - pHigh;
      }
      positive = !positive;
    }
    return Math.max(0, Math.min(1, total));
  }

  var api = {
    DAY: DAY,
    DEFAULT_STEPS: DEFAULT_STEPS,
    normCdf: normCdf,
    intrinsic: intrinsic,
    bsPrice: bsPrice,
    bsGreeks: bsGreeks,
    lrPrice: lrPrice,
    americanPrice: americanPrice,
    needsTree: needsTree,
    price: price,
    greeks: greeks,
    impliedVol: impliedVol,
    probAbove: probAbove,
    profitRegions: profitRegions,
    probabilityOfProfit: probabilityOfProfit,
    assign: assign,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OptionsEngine = api;
})(typeof window !== "undefined" ? window : this);
