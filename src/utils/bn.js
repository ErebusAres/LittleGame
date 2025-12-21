const BN_ROUND = 1e12;

export function isBN(value) {
  return value && typeof value === "object" && typeof value.m === "number" && typeof value.e === "number";
}

export function bnNormalize(value) {
  if (!value) return { m: 0, e: 0 };
  let m = Number(value.m);
  let e = Number(value.e);
  if (!isFinite(m) || !isFinite(e) || m === 0) return { m: 0, e: 0 };
  const sign = m < 0 ? -1 : 1;
  m = Math.abs(m);
  while (m >= 10) {
    m /= 10;
    e += 1;
  }
  while (m < 1) {
    m *= 10;
    e -= 1;
  }
  m = Math.round(m * BN_ROUND) / BN_ROUND;
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  return { m: m * sign, e: Math.trunc(e) };
}

export function bnFromNumber(value) {
  const num = Number(value);
  if (!isFinite(num) || num === 0) return { m: 0, e: 0 };
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const e = Math.floor(Math.log10(abs));
  const m = abs / Math.pow(10, e);
  return bnNormalize({ m: m * sign, e });
}

export function bn(value) {
  if (isBN(value)) return bnNormalize(value);
  if (typeof value === "number") return bnFromNumber(value);
  if (value && typeof value === "object" && "m" in value && "e" in value) {
    return bnNormalize({ m: Number(value.m) || 0, e: Number(value.e) || 0 });
  }
  return bnFromNumber(0);
}

export function bnZero() {
  return { m: 0, e: 0 };
}

export function bnAbs(value) {
  const v = bn(value);
  return v.m < 0 ? { m: -v.m, e: v.e } : v;
}

export function bnCmp(a, b) {
  const av = bn(a);
  const bv = bn(b);
  if (av.m === 0 && bv.m === 0) return 0;
  if (av.m === 0) return bv.m > 0 ? -1 : 1;
  if (bv.m === 0) return av.m > 0 ? 1 : -1;
  if (av.m < 0 && bv.m >= 0) return -1;
  if (av.m >= 0 && bv.m < 0) return 1;
  const sign = av.m < 0 ? -1 : 1;
  if (av.e === bv.e) {
    if (av.m === bv.m) return 0;
    return av.m > bv.m ? sign : -sign;
  }
  return av.e > bv.e ? sign : -sign;
}

export function bnAdd(a, b) {
  const av = bn(a);
  const bv = bn(b);
  if (av.m === 0) return bv;
  if (bv.m === 0) return av;
  if (av.e >= bv.e) {
    const diff = av.e - bv.e;
    if (diff > 20) return av;
    const m = av.m * Math.pow(10, diff) + bv.m;
    return bnNormalize({ m, e: bv.e });
  }
  const diff = bv.e - av.e;
  if (diff > 20) return bv;
  const m = bv.m * Math.pow(10, diff) + av.m;
  return bnNormalize({ m, e: av.e });
}

export function bnSub(a, b) {
  const bv = bn(b);
  return bnAdd(a, { m: -bv.m, e: bv.e });
}

export function bnMul(a, b) {
  const av = bn(a);
  const bv = bn(b);
  if (av.m === 0 || bv.m === 0) return bnZero();
  return bnNormalize({ m: av.m * bv.m, e: av.e + bv.e });
}

export function bnMulScalar(a, scalar) {
  const av = bn(a);
  if (av.m === 0 || scalar === 0) return bnZero();
  return bnNormalize({ m: av.m * scalar, e: av.e });
}

export function bnDivScalar(a, scalar) {
  const av = bn(a);
  if (av.m === 0) return bnZero();
  if (scalar === 0) return { m: Infinity, e: 0 };
  return bnNormalize({ m: av.m / scalar, e: av.e });
}

export function bnShift(a, deltaExp) {
  const av = bn(a);
  if (av.m === 0 || deltaExp === 0) return av;
  return bnNormalize({ m: av.m, e: av.e + deltaExp });
}

export function bnLog10(value) {
  const av = bnAbs(value);
  if (av.m === 0) return 0;
  return Math.log10(av.m) + av.e;
}

export function bnFromLog10(value) {
  if (typeof value === "number") {
    if (!isFinite(value)) return { m: Infinity, e: 0 };
    if (value === 0) return { m: 1, e: 0 };
    const e = Math.floor(value);
    const m = Math.pow(10, value - e);
    return bnNormalize({ m, e });
  }
  const v = bn(value);
  if (v.m === 0) return { m: 1, e: 0 };
  if (v.e <= 6) {
    const numeric = v.m * Math.pow(10, v.e);
    return bnFromLog10(numeric);
  }
  const approx = v.m * Math.pow(10, v.e);
  if (!isFinite(approx)) return { m: 1, e: Number.MAX_SAFE_INTEGER };
  const exp = Math.floor(approx);
  return { m: 1, e: exp };
}

export function bnPowScalar(base, exponent) {
  if (exponent === 0) return bnFromNumber(1);
  const log10Value = Math.log10(base) * exponent;
  return bnFromLog10(log10Value);
}

export function bnPowFromBigExp(base, exponent) {
  const exp = bn(exponent);
  if (exp.m === 0) return bnFromNumber(1);
  const log10Value = bnMulScalar(exp, Math.log10(base));
  return bnFromLog10(log10Value);
}

export function bnToNumber(value) {
  const v = bn(value);
  if (v.m === 0) return 0;
  if (v.e > 308) return v.m < 0 ? -Infinity : Infinity;
  if (v.e < -308) return 0;
  return v.m * Math.pow(10, v.e);
}

export function bnFloor(value) {
  const v = bn(value);
  if (v.m === 0) return v;
  if (v.e >= 6) return v;
  const num = bnToNumber(v);
  if (!isFinite(num)) return v;
  return bnFromNumber(Math.floor(num));
}

export function bnToSave(value) {
  const v = bnNormalize(value);
  return { m: Math.round(v.m * BN_ROUND) / BN_ROUND, e: v.e };
}
