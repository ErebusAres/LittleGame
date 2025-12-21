export const STAGES = [
  { id: 1, name: "Boot" },
  { id: 2, name: "Signal Noise", tierMin: 1, currencyLogMin: 3 },
  { id: 3, name: "Cross-Talk", tierMin: 2, automationMin: 1, currencyLogMin: 4 },
  { id: 4, name: "Drift", tierMin: 3, pendingMin: 1, currencyLogMin: 5 },
  { id: 5, name: "Breach", prestigeMin: 1 },
  { id: 6, name: "Leakage", prestigeMin: 3, tierMin: 7 },
  { id: 7, name: "Saturation", prestigeMin: 7, tierMin: 11 },
  { id: 8, name: "Contamination", prestigeMin: 15, tierMin: 15 },
  { id: 9, name: "Override", prestigeMin: 30, tierMin: 19 },
  { id: 10, name: "Possession", prestigeMin: 50, tierMin: 24 }
];
