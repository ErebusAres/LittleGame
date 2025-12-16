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
  tiers: document.getElementById('tiers'),
  offline: document.getElementById('offline-report'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  resetBtn: document.getElementById('reset-btn'),
  saveData: document.getElementById('save-data'),
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

// Procedural tier helpers
function unlockCostForTier(index) {
  // Exponential scaling: each tier costs roughly 25x the previous unlock cost.
  return 100 * Math.pow(25, index);
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
  };
}

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

function totalAutoRate(tier) {
  return tier.autoLevel * tier.baseAuto * getMultiplier();
}

function updateAutomationBar(tier, dt) {
  const rate = totalAutoRate(tier);
  if (rate <= 0) {
    tier.barProgress = 0;
    tier.saturated = false;
    tier.barCycle = 2;
    return;
  }
  const cycle = Math.max(0.2, 2 / Math.log10(rate + 2));
  tier.barCycle = cycle;
  tier.saturated = cycle <= 0.25;
  if (tier.saturated) {
    tier.barProgress = 1;
    return;
  }
  tier.barProgress = (tier.barProgress + dt / cycle) % 1;
}

function update(dt) {
  const multiplier = getMultiplier();
  // Automatic generation per tier
  gameState.tiers.forEach((tier) => {
    const gain = tier.autoLevel * tier.baseAuto * dt * multiplier;
    tier.amount += gain;
    updateAutomationBar(tier, dt);
  });

  // Prestige points trickle in slowly and are persistent between prestiges.
  gameState.prestigePoints += dt * gameState.prestigeRate;
}

function render() {
  const primary = gameState.tiers[0];
  ui.clickBtn.textContent = `[CLICK] +${formatNumber(gameState.clickPower * getMultiplier())}`;
  ui.primary.innerHTML = `CREDITS: ${formatNumber(primary.amount)}<br>CLICK POWER: +${formatNumber(gameState.clickPower)} (x${getMultiplier().toFixed(2)} with META)`;

  // Upgrade buttons
  ui.upgrades.innerHTML = '';
  const clickUpgrade = document.createElement('button');
  clickUpgrade.className = 'btn';
  clickUpgrade.textContent = `[UPGRADE CLICK] Cost: ${formatNumber(gameState.clickUpgradeCost)} CREDITS`;
  clickUpgrade.onclick = () => purchaseClickUpgrade();
  ui.upgrades.appendChild(clickUpgrade);

  const autoUpgrade = document.createElement('button');
  autoUpgrade.className = 'btn';
  autoUpgrade.textContent = `[DEPLOY AUTOS] Cost: ${formatNumber(gameState.autoUpgradeCost)} CREDITS`;
  autoUpgrade.onclick = () => purchaseAutoUpgrade();
  ui.upgrades.appendChild(autoUpgrade);

  // Automation status (base tier only)
  const autoRate = totalAutoRate(primary);
  const cycleText = primary.saturated ? 'STATUS: SATURATED' : `CYCLE: ${primary.barCycle.toFixed(2)}s`;
  ui.autoStats.innerHTML = `RATE: ${formatNumber(autoRate)}/sec<br>${renderBar(primary.barProgress, primary.saturated)} ${primary.saturated ? '100%' : `${Math.round(primary.barProgress * 100)}%`}<br>${cycleText}`;

  // Prestige UI
  ui.prestigeStats.innerHTML = `META MULTIPLIER: x${getMultiplier().toFixed(2)}<br>PRESTIGE POINTS: ${formatNumber(gameState.prestigePoints)}<br>GAIN ON PRESTIGE: +${formatNumber(prestigeReward())} META`;

  // Tiers section
  ui.tiers.innerHTML = '';
  gameState.tiers.forEach((tier, index) => {
    const line = document.createElement('div');
    line.className = 'tier';
    const rate = totalAutoRate(tier);
    const saturatedText = tier.saturated ? 'STATUS: SATURATED' : `${Math.round(tier.barProgress * 100)}%`;
    line.innerHTML = `> ${tier.name}\n` +
      ` AMOUNT: ${formatNumber(tier.amount)}\n` +
      ` AUTO: ${formatNumber(rate)}/sec ${renderBar(tier.barProgress, tier.saturated)} ${saturatedText}`;

    // Unlock next tier button
    if (index === gameState.tiers.length - 1) {
      const nextCost = unlockCostForTier(index + 1);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = `[UNLOCK TIER ${index + 2}] Cost: ${formatNumber(nextCost)} ${tier.name}`;
      btn.onclick = () => unlockNextTier(index);
      line.appendChild(document.createElement('br'));
      line.appendChild(btn);
    }

    // Auto upgrade per tier
    const tierAutoBtn = document.createElement('button');
    tierAutoBtn.className = 'btn';
    tierAutoBtn.textContent = `[BOOST AUTO] Cost: ${formatNumber(tierAutoCost(tier))} ${tier.name}`;
    tierAutoBtn.onclick = () => increaseTierAuto(index);
    line.appendChild(document.createElement('br'));
    line.appendChild(tierAutoBtn);

    ui.tiers.appendChild(line);
  });

  // Offline report
  if (gameState.offlineReport) {
    const { elapsed, gained } = gameState.offlineReport;
    ui.offline.textContent = `Time Away: ${formatTime(elapsed)}\nGained: +${formatNumber(gained)} CREDITS`;
  }
}

// Purchase helpers
function purchaseClickUpgrade() {
  const primary = gameState.tiers[0];
  if (primary.amount < gameState.clickUpgradeCost) return;
  primary.amount -= gameState.clickUpgradeCost;
  gameState.clickUpgradeLevel += 1;
  gameState.clickPower = 1 + gameState.clickUpgradeLevel * 0.6;
  gameState.clickUpgradeCost *= 1.6;
  saveGame();
}

function purchaseAutoUpgrade() {
  const primary = gameState.tiers[0];
  if (primary.amount < gameState.autoUpgradeCost) return;
  primary.amount -= gameState.autoUpgradeCost;
  primary.autoLevel += 1;
  gameState.autoUpgradeCost *= 1.75;
  saveGame();
}

function tierAutoCost(tier) {
  return 15 * Math.pow(1.45, tier.autoLevel) * (tier.id + 1);
}

function increaseTierAuto(index) {
  const tier = gameState.tiers[index];
  const cost = tierAutoCost(tier);
  if (tier.amount < cost) return;
  tier.amount -= cost;
  tier.autoLevel += 1;
  saveGame();
}

function unlockNextTier(index) {
  const current = gameState.tiers[index];
  const cost = unlockCostForTier(index + 1);
  if (current.amount < cost) return;
  current.amount -= cost;
  const newTier = createTier(index + 1);
  gameState.tiers.push(newTier);
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
  };
  saveGame();
}

// Event wiring
ui.clickBtn.addEventListener('click', () => {
  const primary = gameState.tiers[0];
  primary.amount += gameState.clickPower * getMultiplier();
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
  const now = Date.now();
  applyOfflineProgress(now);
  gameState.lastActive = now;
  lastFrame = now;
  render();
  requestAnimationFrame(gameLoop);
})();
