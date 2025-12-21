export const achievementSections = ["Progression", "Currency", "Automation", "Efficiency", "Prestige", "Clicks", "Hard Mode"];

export function buildAchievementDefs({ formatNumber, bnCmp, bnFromNumber }) {
  const defs = [];
  const add = (section, id, name, desc, check) => defs.push({ section, id, name, desc, check });

  // Progression milestones up to tier 100 (tier index, excluding tier 0 baseline)
  const tierMilestones = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
  tierMilestones.forEach((t) =>
    add("Progression", `tier-${t}`, `Depth ${t}`, `Reach Tier ${t}`, (s) => s.tiers.length - 1 >= t)
  );

  // Currency holdings milestones
  const cashMilestones = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
  cashMilestones.forEach((v) =>
    add(
      "Currency",
      `cash-${v}`,
      `Reserve ${formatNumber(v)}`,
      `Hold ${formatNumber(v)} Credits at once`,
      (s) => bnCmp(s.tiers[0]?.amount, bnFromNumber(v)) >= 0
    )
  );

  // Automation milestones (tier 0 automation levels)
  [1, 3, 5, 10, 15, 20, 30, 40, 50].forEach((lvl) =>
    add("Automation", `auto-${lvl}`, `Auto Lv${lvl}`, `Reach automation level ${lvl} on Tier 0`, (s) => (s.tiers[0]?.autoLevel || 0) >= lvl)
  );

  // Efficiency milestones (any tier)
  [1, 3, 5, 10, 15, 20, 30].forEach((lvl) =>
    add("Efficiency", `eff-${lvl}`, `Efficient ${lvl}`, `Reach efficiency level ${lvl} on any tier`, (s) =>
      s.tiers.some((t) => (t.efficiencyLevel || 0) >= lvl)
    )
  );

  // Prestige milestones
  [1, 3, 5, 10, 20, 50].forEach((p) =>
    add("Prestige", `prestige-${p}`, `Reboot x${p}`, `Prestige ${p} time${p === 1 ? "" : "s"}`, (s) => (s.stats.prestiges || 0) >= p)
  );

  // Click milestones
  [10, 50, 250, 1000, 5000, 20000].forEach((c) =>
    add("Clicks", `clicks-${c}`, `Clicker ${formatNumber(c)}`, `Execute ${formatNumber(c)} total clicks`, (s) => (s.stats.clicks || 0) >= c)
  );

  // Hard mode and difficulty-related
  add("Hard Mode", "diff-10", "Toughen Up", "Set manual difficulty to 10 or higher", (s) => (s.manualDifficulty || 1) >= 10);
  add("Hard Mode", "diff-50", "No Mercy", "Set manual difficulty to 50 or higher", (s) => (s.manualDifficulty || 1) >= 50);
  add("Hard Mode", "diff-100", "Full Brutality", "Set manual difficulty to 100", (s) => (s.manualDifficulty || 1) >= 100);
  add(
    "Hard Mode",
    "hard-tier100",
    "Iron Runner",
    "Reach Tier 100 with difficulty locked at 100% after 1k credits",
    (s) => s.tiers.length - 1 >= 100 && s.manualDifficulty === 100 && s.hardModeStarted && s.hardModeValid
  );

  return defs;
}
