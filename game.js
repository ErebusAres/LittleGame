// Console Incremental - vanilla JS idle game
// Design notes:
// - Single gameState object drives all systems.
// - Delta-time main loop (requestAnimationFrame) to keep performance smooth.
// - Offline progress calculated using the same tick function for consistency.
// - Procedural tiers allow infinite scaling through config-driven helpers.

const SAVE_KEY = 'console-incremental-save';
const SAVE_VERSION = '1.0.0';
const AUTOSAVE_INTERVAL = 10000; // ms
const OFFLINE_CAP_SECONDS = 60 * 60 * 12; // 12 hours soft cap

const ui = {
  primary: document.getElementById('primary-stats'),
  clickBtn: document.getElementById('click-btn'),
  upgrades: document.getElementById('upgrade-controls'),
  autoStats: document.getElementById('auto-stats'),
  prestigeStats: document.getElementById('prestige-stats'),
  prestigeBtn: document.getElementById('prestige-btn'),
  prestigeSection: document.getElementById('prestige'),
  tiers: document.getElementById('tiers'),
  tiersSection: document.getElementById('currency-tiers'),
  offline: document.getElementById('offline-report'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  resetBtn: document.getElementById('reset-btn'),
  saveData: document.getElementById('save-data'),
  statusLine: document.getElementById('status-line'),
  clickUpgradeBtn: null,
  autoUpgradeBtn: null,
  globalUpgradesContainer: null,
};

// Utility helpers
function formatNumber(value) {
  if (value >= 1e12) return value.toExponential(2);
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'k';
  return value.toFixed(2);
}

function formatTime(seconds) {
  if (seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message) {
  gameState.statusMessage = message;
  // retrigger flash animation for visual feedback
  ui.statusLine.classList.remove('status-flash');
  // force reflow so the class re-applies
  void ui.statusLine.offsetWidth;
  ui.statusLine.classList.add('status-flash');
}

// Procedural tier helpers
function unlockDiscountFactor() {
  const level = gameState.globalUpgrades.unlockDiscount || 0;
  return Math.pow(0.93, level);
}

function unlockCostForTier(index) {
  // Exponential scaling: each tier costs roughly 25x the previous unlock cost.
  return 100 * Math.pow(25, index) * unlockDiscountFactor();
}

function baseAutoForTier(index) {
  // Higher tiers generate more quickly; base rate rises gently.
  return Math.max(0.3, Math.pow(1.45, index));
}

function createTier(index) {
  return {
    id: index,
    name: `Tier ${index + 1}`,
    amount: 0,
    autoLevel: index === 0 ? 0 : 1, // first tier relies on manual clicks initially
    baseAuto: baseAutoForTier(index),
    barProgress: 0,
    barCycle: 2,
    saturated: false,
    efficiencyLevel: 0,
    capacityLevel: 0,
  };
}

// Global upgrade definitions keep the system data-driven and extendable.
const globalUpgradeDefs = [
  {
    id: 'autoBoost',
    name: 'Global Auto Multiplier',
    description: 'Increase all automation by +15% per level.',
    baseCost: 200,
    scaling: 2,
    unlockCondition: () => gameState.tiers.some((t) => t.autoLevel > 0),
  },
  {
    id: 'unlockDiscount',
    name: 'Tier Unlock Discount',
    description: 'Reduce future tier unlock costs slightly.',
    baseCost: 500,
    scaling: 2.5,
    unlockCondition: () => gameState.tiers.length >= 2,
  },
  {
    id: 'cycleAccel',
    name: 'Automation Accelerator',
    description: 'Speed up automation cycles globally.',
    baseCost: 750,
    scaling: 2.25,
    unlockCondition: () => gameState.tiers.length >= 3 || (gameState.tiers[1] && gameState.tiers[1].autoLevel > 0),
  },
];

// Core game state
let gameState = {
  version: SAVE_VERSION,
  tiers: [createTier(0)],
  clickPower: 1,
  clickUpgradeLevel: 0,
  clickUpgradeCost: 10,
  autoUpgradeCost: 25,
  prestigePoints: 0,
  prestigeRate: 0.0025, // per second
  metaPoints: 0,
  lastTick: Date.now(),
  lastSave: Date.now(),
  lastActive: Date.now(),
  offlineReport: null,
  statusMessage: 'Awaiting input...',
  globalUpgrades: {
    autoBoost: 0,
    unlockDiscount: 0,
    cycleAccel: 0,
  },
  tiersEverVisible: false,
};

// Rendering helpers
function renderBar(progress, saturated) {
  const total = 20;
  const filled = saturated ? total : Math.round(progress * total);
  const empty = total - filled;
  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
}

function getMultiplier() {
  return 1 + gameState.metaPoints * 0.01;
}

function globalAutoMultiplier() {
  return 1 + (gameState.globalUpgrades.autoBoost || 0) * 0.15;
}

function tierEfficiency(tier) {
  return 1 + (tier.efficiencyLevel || 0) * 0.25;
}

function tierCapacityBonus(tier) {
  // Acts as a gentle soft-cap buffer that improves throughput.
  return 1 + (tier.capacityLevel || 0) * 0.1;
}

function automationCycleFactor() {
  const accel = gameState.globalUpgrades.cycleAccel || 0;
  return 1 - Math.min(0.6, accel * 0.07);
}

function totalAutoRate(tier) {
  const rate = tier.autoLevel * tier.baseAuto * tierEfficiency(tier) * tierCapacityBonus(tier) * globalAutoMultiplier() * getMultiplier();
  // Ensure Tier 0 feels meaningful immediately; clamp early rate to at least 1/sec once purchased.
  if (tier.id === 0 && tier.autoLevel > 0) {
    return Math.max(1, rate);
  }
  return rate;
}

function updateAutomationBar(tier, dt) {
  const rate = totalAutoRate(tier);
  if (rate <= 0) {
    tier.barProgress = 0;
    tier.saturated = false;
    tier.barCycle = 2;
    return;
  }
  const cycleBase = Math.max(0.2, 2 / Math.log10(rate + 2));
  const cycle = cycleBase * automationCycleFactor();
  tier.barCycle = cycle;
  tier.saturated = cycle <= 0.25;
  if (tier.saturated) {
    tier.barProgress = 1;
    return;
  }
  tier.barProgress = (tier.barProgress + dt / cycle) % 1;
}

function pulseAutomationBar(tier) {
  tier.barProgress = 1;
  updateAutomationBar(tier, 0);
}

function update(dt) {
  // Automatic generation per tier
  gameState.tiers.forEach((tier) => {
    const gain = totalAutoRate(tier) * dt;
    tier.amount += gain;
    updateAutomationBar(tier, dt);
  });

  // Prestige points trickle in slowly and are persistent between prestiges.
  gameState.prestigePoints += dt * gameState.prestigeRate;
}

// Tier UI cache to avoid rebuilding buttons and losing handlers.
const tierUiMap = new Map();

function resetTierUI() {
  tierUiMap.clear();
  ui.tiers.innerHTML = '';
  ui.globalUpgradesContainer = null;
}

function ensureTierUI(tier) {
  if (tierUiMap.has(tier.id)) return tierUiMap.get(tier.id);

  const container = document.createElement('div');
  container.className = 'tier';

  const info = document.createElement('div');
  info.className = 'tier-info';
  container.appendChild(info);

  const upgradesContainer = document.createElement('div');
  upgradesContainer.className = 'tier-upgrades';
  container.appendChild(upgradesContainer);

  ui.tiers.appendChild(container);

  const entry = { container, info, upgradesContainer, buttons: new Map() };
  tierUiMap.set(tier.id, entry);
  return entry;
}

function tierAutoCost(tier) {
  return 15 * Math.pow(1.45, tier.autoLevel) * (tier.id + 1);
}

function tierEfficiencyCost(tier) {
  return 40 * (tier.id + 1) * Math.pow(1.7, tier.efficiencyLevel);
}

function tierCapacityCost(tier) {
  return 120 * (tier.id + 1) * Math.pow(1.8, tier.capacityLevel);
}

function tierUpgradeDefinitions(tier) {
  const defs = [];
  defs.push({
    id: `auto-${tier.id}`,
    name: 'Auto Boost',
    detail: 'Increase automation level (+1).',
    getCost: (t) => tierAutoCost(t),
    available: () => true,
    apply: (t, cost) => {
      t.amount -= cost;
      t.autoLevel += 1;
      pulseAutomationBar(t);
      setStatus(`${t.name} automation tuned to ${formatNumber(totalAutoRate(t))}/sec.`);
    },
  });

  defs.push({
    id: `eff-${tier.id}`,
    name: 'Efficiency',
    detail: 'Boost output by +25% per level.',
    getCost: (t) => tierEfficiencyCost(t),
    available: () => tier.id > 0 || tHasAutomation(tier) || gameState.tiers.length > 1,
    apply: (t, cost) => {
      t.amount -= cost;
      t.efficiencyLevel += 1;
      setStatus(`${t.name} efficiency upgraded (x${tierEfficiency(t).toFixed(2)}).`);
    },
  });

  defs.push({
    id: `cap-${tier.id}`,
    name: 'Capacity',
    detail: 'Storage overflow buffer (+10% throughput).',
    getCost: (t) => tierCapacityCost(t),
    available: () => tier.id > 1 || tHasAutomation(tier),
    apply: (t, cost) => {
      t.amount -= cost;
      t.capacityLevel += 1;
      setStatus(`${t.name} capacity expanded (x${tierCapacityBonus(t).toFixed(2)}).`);
    },
  });

  return defs.filter((def) => def.available());
}

function tHasAutomation(tier) {
  return tier.autoLevel > 0;
}

function handleTierUpgrade(tierId, upgradeId) {
  const tier = gameState.tiers.find((t) => t.id === tierId);
  if (!tier) return;
  const defs = tierUpgradeDefinitions(tier);
  const def = defs.find((d) => d.id === upgradeId);
  if (!def) return;
  const cost = def.getCost(tier);
  if (tier.amount < cost) {
    setStatus('INSUFFICIENT CREDITS');
    return;
  }
  def.apply(tier, cost);
  render();
  saveGame();
}

function updateTierUI(tier) {
  const entry = ensureTierUI(tier);
  const rate = totalAutoRate(tier);
  const saturatedText = tier.saturated ? 'STATUS: SATURATED' : `${Math.round(tier.barProgress * 100)}%`;
  entry.info.textContent = `> ${tier.name}\n AMOUNT: ${formatNumber(tier.amount)}\n AUTO LV ${tier.autoLevel}: ${formatNumber(rate)}/sec ${renderBar(tier.barProgress, tier.saturated)} ${saturatedText}`;

  const defs = tierUpgradeDefinitions(tier).map((def) => ({
    ...def,
    cost: def.getCost(tier),
  }));

  // Include unlock action in the same cost ordering for clarity on next steps.
  if (tier.id === gameState.tiers.length - 1) {
    defs.push({
      id: `unlock-${tier.id}`,
      name: `Unlock Tier ${tier.id + 2}`,
      detail: 'Open the next tier.',
      cost: unlockCostForTier(tier.id + 1),
      onClick: () => unlockNextTier(tier.id),
    });
  }

  defs.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

  const fragment = document.createDocumentFragment();
  defs.forEach((def) => {
    let btn = entry.buttons.get(def.id);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn';
      const handler = def.onClick ? def.onClick : () => handleTierUpgrade(tier.id, def.id);
      btn.onclick = handler;
      entry.buttons.set(def.id, btn);
    }
    btn.textContent = `[${def.name}] ${def.detail} Cost: ${formatNumber(def.cost)} ${tier.name}`;
    btn.disabled = tier.amount < def.cost;
    fragment.appendChild(btn);
    fragment.appendChild(document.createElement('br'));
  });

  // Replace upgrade ordering without recreating buttons.
  entry.upgradesContainer.innerHTML = '';
  entry.upgradesContainer.appendChild(fragment);
}

function globalUpgradeCost(def) {
  const level = gameState.globalUpgrades[def.id] || 0;
  return def.baseCost * Math.pow(def.scaling, level);
}

function handleGlobalUpgrade(id) {
  const def = globalUpgradeDefs.find((d) => d.id === id);
  if (!def) return;
  const cost = globalUpgradeCost(def);
  const primary = gameState.tiers[0];
  if (primary.amount < cost) {
    setStatus('INSUFFICIENT CREDITS');
    return;
  }
  primary.amount -= cost;
  gameState.globalUpgrades[id] = (gameState.globalUpgrades[id] || 0) + 1;
  setStatus(`${def.name} upgraded (Lvl ${gameState.globalUpgrades[id]}).`);
  render();
  saveGame();
}

function ensureGlobalUpgradesUI() {
  if (ui.globalUpgradesContainer) return;
  ui.globalUpgradesContainer = document.createElement('div');
  ui.globalUpgradesContainer.className = 'tier global-upgrades';
  const header = document.createElement('div');
  header.textContent = 'GLOBAL UPGRADES';
  ui.globalUpgradesContainer.appendChild(header);
  const list = document.createElement('div');
  list.className = 'tier-upgrades';
  ui.globalUpgradesContainer.list = list;
  ui.globalUpgradesContainer.appendChild(list);
  ui.tiers.prepend(ui.globalUpgradesContainer);
  ui.globalUpgradesContainer.buttons = new Map();
}

function updateGlobalUpgradesUI() {
  ensureGlobalUpgradesUI();
  const list = ui.globalUpgradesContainer.list;
  const buttons = ui.globalUpgradesContainer.buttons;

  const available = globalUpgradeDefs
    .filter((def) => def.unlockCondition())
    .map((def) => ({ ...def, cost: globalUpgradeCost(def) }))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

  const fragment = document.createDocumentFragment();
  available.forEach((def) => {
    let btn = buttons.get(def.id);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn';
      btn.onclick = () => handleGlobalUpgrade(def.id);
      buttons.set(def.id, btn);
    }
    const level = gameState.globalUpgrades[def.id] || 0;
    btn.textContent = `[${def.name} Lv${level}] ${def.description} Cost: ${formatNumber(def.cost)} CREDITS`;
    btn.disabled = gameState.tiers[0].amount < def.cost;
    fragment.appendChild(btn);
    fragment.appendChild(document.createElement('br'));
  });

  list.innerHTML = '';
  list.appendChild(fragment);
}

function render() {
  const primary = gameState.tiers[0];
  ui.clickBtn.textContent = `[CLICK] +${formatNumber(gameState.clickPower * getMultiplier())}`;
  ui.primary.innerHTML = `CREDITS: ${formatNumber(primary.amount)}<br>CLICK POWER: +${formatNumber(gameState.clickPower)} (x${getMultiplier().toFixed(2)} with META)`;

  // Upgrade buttons are created once; render only updates text/disabled to keep wiring intact.
  if (ui.clickUpgradeBtn) {
    ui.clickUpgradeBtn.textContent = `[UPGRADE CLICK] Cost: ${formatNumber(gameState.clickUpgradeCost)} CREDITS`;
    ui.clickUpgradeBtn.disabled = primary.amount < gameState.clickUpgradeCost;
  }
  if (ui.autoUpgradeBtn) {
    ui.autoUpgradeBtn.textContent = `[DEPLOY AUTOS] Cost: ${formatNumber(gameState.autoUpgradeCost)} CREDITS`;
    ui.autoUpgradeBtn.disabled = primary.amount < gameState.autoUpgradeCost;
  }

  // Automation status (base tier only)
  const autoRate = totalAutoRate(primary);
  const cycleText = primary.saturated ? 'STATUS: SATURATED' : `CYCLE: ${primary.barCycle.toFixed(2)}s`;
  ui.autoStats.innerHTML = `AUTO LEVEL: ${primary.autoLevel}<br>RATE: ${formatNumber(autoRate)}/sec<br>${renderBar(primary.barProgress, primary.saturated)} ${primary.saturated ? '100%' : `${Math.round(primary.barProgress * 100)}%`}<br>${cycleText}`;

  // Prestige UI
  ui.prestigeStats.innerHTML = `META MULTIPLIER: x${getMultiplier().toFixed(2)}<br>PRESTIGE POINTS: ${formatNumber(gameState.prestigePoints)}<br>GAIN ON PRESTIGE: +${formatNumber(prestigeReward())} META`;

  updateGlobalUpgradesUI();

  gameState.tiers.forEach((tier) => updateTierUI(tier));

  // Offline report
  if (gameState.offlineReport) {
    const { elapsed, gained } = gameState.offlineReport;
    ui.offline.textContent = `Time Away: ${formatTime(elapsed)}\nGained: +${formatNumber(gained)} CREDITS`;
  }

  ui.statusLine.textContent = `STATUS: ${gameState.statusMessage}`;

  // Conditional visibility to reduce cognitive load but keep unlocked systems visible once shown.
  const tiersVisible = gameState.tiersEverVisible || gameState.tiers.length > 1 || gameState.tiers.some((tier) => tier.autoLevel > 0);
  if (tiersVisible) gameState.tiersEverVisible = true;
  ui.tiersSection.classList.toggle('hidden', !tiersVisible);
  ui.prestigeSection.classList.toggle('hidden', gameState.tiers.length < 2);
}

// Purchase helpers
function purchaseClickUpgrade() {
  const primary = gameState.tiers[0];
  if (primary.amount < gameState.clickUpgradeCost) {
    setStatus('INSUFFICIENT CREDITS');
    return;
  }
  primary.amount -= gameState.clickUpgradeCost;
  gameState.clickUpgradeLevel += 1;
  // Lean into early clarity: linear +2 per level keeps clicks obviously stronger.
  gameState.clickPower = 1 + gameState.clickUpgradeLevel * 2;
  gameState.clickUpgradeCost *= 1.6;
  setStatus(`Click strength boosted to +${formatNumber(gameState.clickPower)}.`);
  render();
  saveGame();
}

function purchaseAutoUpgrade() {
  const primary = gameState.tiers[0];
  if (primary.amount < gameState.autoUpgradeCost) {
    setStatus('INSUFFICIENT CREDITS');
    return;
  }
  primary.amount -= gameState.autoUpgradeCost;
  primary.autoLevel += 1;
  gameState.autoUpgradeCost *= 1.75;
  pulseAutomationBar(primary);
  setStatus(`Automation online: RATE ${formatNumber(totalAutoRate(primary))}/sec.`);
  render();
  saveGame();
}

function unlockNextTier(index) {
  const current = gameState.tiers[index];
  const cost = unlockCostForTier(index + 1);
  if (current.amount < cost) {
    setStatus('INSUFFICIENT CREDITS');
    return;
  }
  current.amount -= cost;
  const newTier = createTier(index + 1);
  gameState.tiers.push(newTier);
  setStatus(`${newTier.name} unlocked.`);
  gameState.tiersEverVisible = true;
  render();
  saveGame();
}

// Prestige logic
function prestigeReward() {
  // Meta gained equals prestige points with diminishing returns to avoid runaway scaling.
  const points = gameState.prestigePoints;
  return Math.pow(points, 0.9);
}

function performPrestige() {
  const reward = prestigeReward();
  gameState.metaPoints += reward;
  gameState.prestigePoints = 0;
  gameState.tiers = [createTier(0)];
  gameState.clickPower = 1;
  gameState.clickUpgradeLevel = 0;
  gameState.clickUpgradeCost = 10;
  gameState.autoUpgradeCost = 25;
  gameState.globalUpgrades = { autoBoost: 0, unlockDiscount: 0, cycleAccel: 0 };
  gameState.tiersEverVisible = false;
  resetTierUI();
  setStatus(`Prestige complete. Meta now x${getMultiplier().toFixed(2)}.`);
  saveGame();
}

// Offline progress
function applyOfflineProgress(now) {
  const elapsedSeconds = clamp((now - gameState.lastActive) / 1000, 0, OFFLINE_CAP_SECONDS);
  if (elapsedSeconds <= 0) return;
  const before = gameState.tiers[0].amount;
  update(elapsedSeconds);
  const gained = gameState.tiers[0].amount - before;
  gameState.offlineReport = { elapsed: elapsedSeconds, gained };
}

// Save system
function serializeState() {
  return {
    ...gameState,
    version: SAVE_VERSION,
    lastTick: Date.now(),
    lastActive: Date.now(),
  };
}

function saveGame() {
  gameState.lastSave = Date.now();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(serializeState()))));
  localStorage.setItem(SAVE_KEY, encoded);
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (parsed.version !== SAVE_VERSION) throw new Error('Version mismatch');
    gameState = {
      ...gameState,
      ...parsed,
    };
    // Recreate tier prototypes if needed
    gameState.tiers = parsed.tiers.map((tier, i) => ({
      ...createTier(tier.id ?? i),
      ...tier,
    }));
    // Recalculate click power using the current linear formula to keep impact consistent across saves.
    gameState.clickPower = 1 + (gameState.clickUpgradeLevel || 0) * 2;
    gameState.statusMessage = parsed.statusMessage || 'Awaiting input...';
    // Initialize new structures for backward compatibility.
    gameState.globalUpgrades = {
      autoBoost: parsed.globalUpgrades?.autoBoost || 0,
      unlockDiscount: parsed.globalUpgrades?.unlockDiscount || 0,
      cycleAccel: parsed.globalUpgrades?.cycleAccel || 0,
    };
    gameState.tiersEverVisible = parsed.tiersEverVisible || false;
  } catch (e) {
    console.warn('Failed to load save', e);
  }
}

function exportSave() {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(serializeState()))));
  ui.saveData.value = payload;
}

function importSave() {
  const data = ui.saveData.value.trim();
  if (!data) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(data))));
    if (parsed.version !== SAVE_VERSION) throw new Error('Version mismatch');
    gameState = {
      ...gameState,
      ...parsed,
    };
    gameState.tiers = parsed.tiers.map((tier, i) => ({
      ...createTier(tier.id ?? i),
      ...tier,
    }));
    gameState.globalUpgrades = {
      autoBoost: parsed.globalUpgrades?.autoBoost || 0,
      unlockDiscount: parsed.globalUpgrades?.unlockDiscount || 0,
      cycleAccel: parsed.globalUpgrades?.cycleAccel || 0,
    };
    resetTierUI();
    render();
    saveGame();
  } catch (e) {
    alert('Import failed: ' + e.message);
  }
}

function resetSave() {
  if (!confirm('Reset all progress? This cannot be undone.')) return;
  localStorage.removeItem(SAVE_KEY);
  gameState = {
    version: SAVE_VERSION,
    tiers: [createTier(0)],
    clickPower: 1,
    clickUpgradeLevel: 0,
    clickUpgradeCost: 10,
    autoUpgradeCost: 25,
    prestigePoints: 0,
    prestigeRate: 0.0025,
    metaPoints: 0,
    lastTick: Date.now(),
    lastSave: Date.now(),
    lastActive: Date.now(),
    offlineReport: null,
    statusMessage: 'Awaiting input...',
    globalUpgrades: { autoBoost: 0, unlockDiscount: 0, cycleAccel: 0 },
    tiersEverVisible: false,
  };
  resetTierUI();
  setStatus('Progress reset. Fresh start.');
  saveGame();
}

function setupUpgradeButtons() {
  // Buttons are created once so event handlers persist; render only updates state/text.
  if (!ui.clickUpgradeBtn) {
    ui.clickUpgradeBtn = document.createElement('button');
    ui.clickUpgradeBtn.className = 'btn';
    ui.clickUpgradeBtn.onclick = () => purchaseClickUpgrade();
    ui.upgrades.appendChild(ui.clickUpgradeBtn);
  }
  if (!ui.autoUpgradeBtn) {
    ui.autoUpgradeBtn = document.createElement('button');
    ui.autoUpgradeBtn.className = 'btn';
    ui.autoUpgradeBtn.onclick = () => purchaseAutoUpgrade();
    ui.upgrades.appendChild(ui.autoUpgradeBtn);
  }
}

// Event wiring
ui.clickBtn.addEventListener('click', () => {
  const primary = gameState.tiers[0];
  primary.amount += gameState.clickPower * getMultiplier();
  setStatus(`Manual input registered (+${formatNumber(gameState.clickPower * getMultiplier())}).`);
  saveGame();
});
ui.prestigeBtn.addEventListener('click', () => performPrestige());
ui.exportBtn.addEventListener('click', () => exportSave());
ui.importBtn.addEventListener('click', () => importSave());
ui.resetBtn.addEventListener('click', () => resetSave());

testStorageAvailability();

function testStorageAvailability() {
  try {
    localStorage.setItem('_test', '1');
    localStorage.removeItem('_test');
  } catch (e) {
    alert('LocalStorage unavailable. Progress will not persist.');
  }
}

// Main loop
let lastFrame = Date.now();
function gameLoop() {
  const now = Date.now();
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  update(dt);
  render();

  if (now - gameState.lastSave >= AUTOSAVE_INTERVAL) {
    saveGame();
  }

  requestAnimationFrame(gameLoop);
}

// Initialization
(function init() {
  loadGame();
  resetTierUI();
  setupUpgradeButtons();
  const now = Date.now();
  applyOfflineProgress(now);
  gameState.lastActive = now;
  lastFrame = now;
  render();
  requestAnimationFrame(gameLoop);
})();
