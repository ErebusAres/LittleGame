export const globalUpgradeDefs = [
  { id: "clickBurst", name: "Click Tap", desc: "+0.4 click strength", baseCost: 12, costGrowth: 1.7 },
  { id: "click", name: "Click Power", desc: "+0.8 click strength", baseCost: 25, costGrowth: 1.85 },
  { id: "automation", name: "Automation Core", desc: "+12% automation power", baseCost: 60, costGrowth: 1.75 },
  { id: "threads", name: "Parallel Threads", desc: "+0.2 base auto/sec", baseCost: 85, costGrowth: 1.8 },
  { id: "overclock", name: "Core Overclock", desc: "+3% all output", baseCost: 120, costGrowth: 1.9 },
  { id: "buffer", name: "Buffer Control", desc: "+2% tier efficiency", baseCost: 160, costGrowth: 1.95 }
];

export const metaUpgradeDefs = [
  { id: "prestigeBoost", name: "Signal Booster", desc: "+4% all gains", baseCost: 10, costGrowth: 2.1 },
  { id: "clickPersist", name: "Macro Training", desc: "+15% click strength", baseCost: 12, costGrowth: 2.15 },
  { id: "autoPersist", name: "Daemon Overclock", desc: "+10% auto output", baseCost: 14, costGrowth: 2.2 },
  { id: "offlineBoost", name: "Offline Cache", desc: "+8% offline gains", baseCost: 18, costGrowth: 2.2 },
  { id: "difficultySoftener", name: "Load Balancer", desc: "-4% difficulty scale", baseCost: 24, costGrowth: 2.3 }
];
