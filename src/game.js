import { tierNames } from "./data/tiers.js";
import { globalUpgradeDefs, metaUpgradeDefs } from "./data/upgrades.js";
import { npcLinesExtra } from "./data/npc-lines.js";
import { npcLibrary } from "./data/npc-library.js";
import { npcAntiCheatLines, antiCheatSystemLines } from "./data/npc-anti-cheat.js";
import { npcClickPraiseLines } from "./data/npc-click-praise.js";
import { ENCHANT_GLYPHS, DEV_TIPS, ENTITY_LINES } from "./data/lore.js";
import { STAGES } from "./data/stages.js";
import { BIG_SUFFIXES } from "./data/suffixes.js";
import { OPERATOR_RANKS } from "./data/ranks.js";
import { chatSources, WHISPER_COLOR } from "./data/chat-sources.js";
import { npcVoices } from "./data/npc-voices.js";
import { buildAchievementDefs, achievementSections } from "./data/achievements.js";
import {
  bn,
  bnZero,
  bnAbs,
  bnCmp,
  bnAdd,
  bnSub,
  bnMul,
  bnMulScalar,
  bnDivScalar,
  bnShift,
  bnLog10,
  bnFromNumber,
  bnFromLog10,
  bnPowScalar,
  bnPowFromBigExp,
  bnToNumber,
  bnFloor,
  bnToSave,
  isBN
} from "./utils/bn.js";

const GAME_VERSION = 1;
const DEV_MODE = false;
const devTips = DEV_TIPS;
const entityLines = ENTITY_LINES;

const STORAGE_KEY = "terminalIdleSaveV1";
const MAX_OFFLINE_SECONDS = 6 * 3600;
const RENDER_INTERVAL_MS = 80;
const MAX_BULK_BUY = 1000000;
const OPS_LOG_LIMIT = 80;
const ENTITY_IMPACT_COOLDOWN_MS = 900;

function seriesCostFromLevel(base, growth, level, count, difficulty = 1) {
  if (count <= 0) return bnZero();
  const start = bnPowScalar(growth, level);
  const sumFactor = bnDivScalar(bnSub(bnPowScalar(growth, count), bnFromNumber(1)), growth - 1);
  return bnMulScalar(bnMul(start, sumFactor), base * difficulty);
}

function seriesCostFromExp(base, growth, exp, count, difficulty = 1) {
  if (count <= 0) return bnZero();
  const start = bnPowFromBigExp(growth, exp);
  const sumFactor = bnDivScalar(bnSub(bnPowScalar(growth, count), bnFromNumber(1)), growth - 1);
  return bnMulScalar(bnMul(start, sumFactor), base * difficulty);
}

function maxAffordableSeries(funds, costForCount, maxCap = MAX_BULK_BUY) {
  if (bnCmp(funds, bnZero()) <= 0) return 0;
  if (bnCmp(costForCount(1), funds) > 0) return 0;
  let low = 1;
  let high = 1;
  while (high < maxCap && bnCmp(costForCount(high), funds) <= 0) {
    low = high;
    high = Math.min(maxCap, high * 2);
  }
  if (low === maxCap) return low;
  let left = low;
  let right = high;
  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    if (bnCmp(costForCount(mid), funds) <= 0) left = mid;
    else right = mid - 1;
  }
  return left;
}

function getBuyMode() {
  return state?.uiPrefs?.buyMode || "1";
}

function getAffordableBuyCount(mode, funds, costFor) {
  if (mode === "max") return maxAffordableSeries(funds, costFor);
  const target = Math.max(1, Math.floor(Number(mode) || 1));
  if (bnCmp(funds, costFor(target)) >= 0) return target;
  if (target > 1 && bnCmp(funds, costFor(1)) >= 0) return 1;
  return 0;
}

function buyLabel(mode, count) {
  if (mode === "1") return "";
  if (mode === "5") return ` x${Math.max(1, count)}`;
  return " Max";
}

const CHAT_HISTORY_LIMIT = 200;
const CHAT_SCROLL_TOLERANCE = 12;
const CLICK_RUN_COOLDOWN = 2200;
const AFK_THRESHOLD_MS = 5 * 60 * 1000;
const NPC_LINE_COOLDOWN_MS = 4500;
const NPC_REPEAT_WINDOW_MS = 45000;
const NPC_GLOBAL_REPEAT_WINDOW_MS = 60000;
const OPS_SCROLL_TOLERANCE = 8;

mergeNpcLines(npcLibrary, npcLinesExtra);
mergeNpcLines(npcLibrary, npcAntiCheatLines);
mergeNpcLines(npcLibrary, npcClickPraiseLines);

const achievementDefs = buildAchievementDefs({ formatNumber, bnCmp, bnFromNumber });

const ui = {};
const tierElements = new Map();
const globalUpgradeButtons = new Map();
const metaUpgradeButtons = new Map();

let state = loadGame();
if (!Array.isArray(state.seenEntityLines)) {
  state.seenEntityLines = [];
}
if (!state.story) {
  state.story = createDefaultStory();
}
applyStoryPresentation();
let lastRender = 0;
let clickRunTimer = null;
let npcChatterTimer = null;
let operatorSpam = { times: [], warned: false };
let npcThreadTimers = [];
let statusState = { message: "", priority: 0, until: 0 };
let entityImpactTimer = null;
let lastEntityImpactAt = 0;
let tooltipTarget = null;
let tooltipMoveRaf = null;

initUI();
setupExitSave();
bootstrapChat();
applyOfflineProgress();
syncStage(false);
render(true);
requestAnimationFrame(loop);

function loop() {
  const now = Date.now();
  const delta = Math.min((now - state.lastTick) / 1000, 0.25);
  state.lastTick = now;
  applyIncome(delta);
  syncStage(false);
  checkEndlessUnlock();
  if (now - state.lastSave > 10000) {
    saveGame();
  }
  if (now - lastRender > RENDER_INTERVAL_MS) {
    render();
    lastRender = now;
  }
  requestAnimationFrame(loop);
}

function orderFromCost(cost, tie = 0) {
  const orderValue = Math.max(0, bnLog10(bnAdd(cost, bnFromNumber(1))));
  return Math.round(orderValue * 1000) * 10 + tie;
}

function tierDisplayName(index) {
  if (tierNames[index]) return tierNames[index];
  return `Layer ${index}`;
}

function tierBaseCost(index) {
  const base = 20 * Math.pow(14, index);
  if (index >= 1 && index <= 5) {
    const factor = Math.max(0.47, 0.62 - index * 0.03);
    return base * factor;
  }
  return base;
}

function makeTier(index) {
  const earlyTier = index >= 1 && index <= 5;
  const baseGrowth = 1.18 + index * 0.02;
  return {
    id: `tier-${index}`,
    index,
    name: tierDisplayName(index),
    amount: bnZero(),
    baseRate: 0.4 * Math.pow(1.15, index) * (earlyTier ? 1.2 : 1),
    baseCost: tierBaseCost(index),
    costGrowth: earlyTier ? Math.max(1.14, baseGrowth - 0.04) : baseGrowth,
    autoLevel: 0,
    efficiencyLevel: 0,
    unlocked: index === 0,
    autoCostBase: 14 * Math.pow(1.7, index + 1) * (earlyTier ? 0.85 : 1),
    effCostBase: 22 * Math.pow(1.75, index + 1) * (earlyTier ? 0.85 : 1)
  };
}

function createDefaultChatState(now = Date.now()) {
  return {
    history: [],
    scrollLock: false,
    runCount: 0,
    lastClickTs: 0,
    lastRunFlush: now,
    lastDivider: 0,
    lastNpcWhisper: 0,
    flags: {
      npcProgress: {},
      greeted: false,
      npcMemory: {}
    }
  };
}

function createDefaultStory(now = Date.now()) {
  return {
    arcStage: 0,
    seenBeats: {},
    endlessUnlocked: false,
    title: "Operator",
    uiMode: "classic",
    unlockedAt: null,
    updatedAt: now
  };
}

function createDefaultState() {
  const now = Date.now();
  const stage = STAGES[0];
  return {
    version: GAME_VERSION,
    tiers: [makeTier(0)],
    globalUpgrades: { click: 0, clickBurst: 0, automation: 0, threads: 0, overclock: 0, buffer: 0 },
    prestige: {
      points: bnZero(),
      pending: bnZero(),
      lastRebootAt: now,
      minRequired: 12,
      upgrades: { prestigeBoost: 0, clickPersist: 0, autoPersist: 0, offlineBoost: 0, difficultySoftener: 0 }
    },
    lastTick: now,
    lastSave: now,
    lastActionAt: now,
    totalCurrency: bnZero(),
    status: "Booted",
    offlineSummary: { gain: bnZero(), seconds: 0 },
    sessionStart: now,
    manualDifficulty: 1,
    achievements: [],
    stats: { clicks: 0, prestiges: 0 },
    hardModeStarted: false,
    hardModeValid: true,
    clickHistory: [],
    clickPenaltyUntil: 0,
    penaltyScale: 1,
    lastCps: 0,
    lastClickTime: 0,
    integrityFlag: false,
    playerName: null,
    seenEntityLines: [],
    opsLog: [],
    uiPrefs: {
      buyMode: "1",
      sortUpgradesByCost: false,
      opsCollapsed: false,
      panels: {}
    },
    story: createDefaultStory(now),
    stage: { id: stage.id, name: stage.name, index: 0, at: now },
    chat: createDefaultChatState(now)
  };
}

function mergeState(base, saved) {
  const merged = { ...base, ...saved };
  merged.story = mergeStoryState(base.story, saved.story || {});
  merged.version = GAME_VERSION;
  merged.globalUpgrades = { ...base.globalUpgrades, ...(saved.globalUpgrades || {}) };
  merged.prestige = {
    ...base.prestige,
    ...(saved.prestige || {}),
    upgrades: { ...base.prestige.upgrades, ...(saved.prestige?.upgrades || {}) }
  };
  merged.prestige.points = bn(saved.prestige?.points ?? base.prestige.points);
  merged.prestige.pending = bn(saved.prestige?.pending ?? base.prestige.pending);
  merged.prestige.minRequired = Number(saved.prestige?.minRequired || base.prestige.minRequired);
  merged.prestige.lastRebootAt = saved.prestige?.lastRebootAt || base.prestige.lastRebootAt;
  merged.tiers = [];
  const savedTiers = Array.isArray(saved.tiers) ? saved.tiers : [];
  const count = Math.max(1, Math.min(101, savedTiers.length || 1));
  for (let i = 0; i < count; i++) {
    const template = makeTier(i);
    const savedTier = savedTiers[i] || {};
    merged.tiers.push({
      ...template,
      amount: bn(savedTier.amount),
      autoLevel: Number(savedTier.autoLevel) || 0,
      efficiencyLevel: Number(savedTier.efficiencyLevel) || 0,
      unlocked: savedTier.unlocked ?? i === 0,
      _lockedAcquireCost: savedTier._lockedAcquireCost != null ? bn(savedTier._lockedAcquireCost) : null
    });
  }
  merged.totalCurrency = bn(saved.totalCurrency ?? base.totalCurrency);
  merged.lastTick = saved.lastTick || Date.now();
  merged.lastSave = saved.lastSave || Date.now();
  merged.lastActionAt = Date.now();
  merged.sessionStart = saved.sessionStart || Date.now();
  merged.offlineSummary = {
    gain: bn(saved.offlineSummary?.gain ?? base.offlineSummary.gain),
    seconds: Number(saved.offlineSummary?.seconds) || 0
  };
  merged.manualDifficulty = Math.min(100, Math.max(1, Number(saved.manualDifficulty) || 1));
  merged.achievements = Array.isArray(saved.achievements) ? saved.achievements : [];
  merged.stats = { clicks: 0, prestiges: 0, ...(saved.stats || {}) };
  merged.hardModeStarted = !!saved.hardModeStarted;
  merged.hardModeValid = saved.hardModeValid !== false;
  merged.clickHistory = Array.isArray(saved.clickHistory) ? saved.clickHistory : [];
  merged.clickPenaltyUntil = Number(saved.clickPenaltyUntil) || 0;
  merged.penaltyScale = saved.penaltyScale || 1;
  merged.lastCps = saved.lastCps || 0;
  merged.cpsGraceUntil = saved.cpsGraceUntil || 0;
  merged.cpsGraceCooldownUntil = saved.cpsGraceCooldownUntil || 0;
  merged.lastClickTime = saved.lastClickTime || 0;
  merged.integrityFlag = !!saved.integrityFlag;
  merged.status = saved.status || "Recovered save";
  merged.playerName = saved.playerName || null;
  merged.opsLog = Array.isArray(saved.opsLog)
    ? saved.opsLog.slice(-OPS_LOG_LIMIT).map((entry) => ({
      ts: Number(entry?.ts) || Date.now(),
      text: String(entry?.text ?? entry ?? ""),
      category: entry?.category || "system"
    }))
    : [];
  merged.uiPrefs = { ...base.uiPrefs, ...(saved.uiPrefs || {}) };
  if (merged.uiPrefs.opsCollapsed == null) {
    merged.uiPrefs.opsCollapsed = false;
  }
  if (!merged.uiPrefs.panels || typeof merged.uiPrefs.panels !== "object") {
    merged.uiPrefs.panels = {};
  }
  const savedStageIndex = Number(saved.stage?.index ?? saved.stageIndex ?? 0);
  const stageIndex = Math.max(0, Math.min(STAGES.length - 1, savedStageIndex));
  const stageInfo = STAGES[stageIndex] || STAGES[0];
  merged.stage = {
    id: stageInfo.id,
    name: stageInfo.name,
    index: stageIndex,
    at: saved.stage?.at || Date.now()
  };
  merged.chat = mergeChatState(createDefaultChatState(), saved.chat || {});
  return merged;
}

function mergeStoryState(baseStory, savedStory) {
  const base = baseStory || createDefaultStory();
  if (!savedStory || typeof savedStory !== "object") return { ...base };
  const endlessTitle = savedStory.endlessUnlocked && !savedStory.title ? "Warden" : savedStory.title;
  return {
    ...base,
    ...savedStory,
    seenBeats: { ...(base.seenBeats || {}), ...(savedStory.seenBeats || {}) },
    title: endlessTitle || base.title
  };
}

function resolveStageIndex() {
  const tierIndex = Math.max(0, state.tiers.length - 1);
  const prestiges = Math.max(0, state.stats?.prestiges || 0);
  const pending = bn(state.prestige.pending);
  const totalLog = Math.max(0, bnLog10(state.totalCurrency));
  const automation = state.globalUpgrades.automation || 0;

  for (let i = STAGES.length - 1; i >= 1; i--) {
    const stage = STAGES[i];
    let reached = false;
    if (stage.tierMin != null && tierIndex >= stage.tierMin) reached = true;
    if (stage.prestigeMin != null && prestiges >= stage.prestigeMin) reached = true;
    if (stage.pendingMin != null && bnCmp(pending, bnFromNumber(stage.pendingMin)) >= 0) reached = true;
    if (stage.currencyLogMin != null && totalLog >= stage.currencyLogMin) reached = true;
    if (stage.automationMin != null && automation >= stage.automationMin) reached = true;
    if (reached) return i;
  }
  return 0;
}

function getCurrentStage() {
  const index = typeof state.stage?.index === "number" ? state.stage.index : resolveStageIndex();
  const safeIndex = Math.max(0, Math.min(STAGES.length - 1, index));
  const stage = STAGES[safeIndex] || STAGES[0];
  return { ...stage, index: safeIndex };
}

function applyStageUI(stage) {
  if (document.body) {
    document.body.dataset.stage = String(stage.id);
  }
}

function handleStageTransition(prevStage, nextStage) {
  const now = Date.now();
  if (!nextStage) return;
  setStatus(`Stage ${nextStage.id}: ${nextStage.name}`, { priority: 3, holdMs: 8000 });
  logOpsEvent(`stage shift: ${nextStage.name} (${nextStage.id}/10)`, "entity");
  insertChatDivider(`stage ${nextStage.id} // ${nextStage.name}`);
  const context = buildNpcContext({ stage: nextStage.name, stageIndex: nextStage.id });
  const template = pickLine(npcLibrary.stageTransition || [], context, { allowRapid: true, repeatWindow: 12000 });
  if (template) {
    const line = formatNpcText(template, chatSources.entity, context);
    logChatEvent(chatSources.entity, line, { forceScroll: true });
  } else if (now - (state.chat.flags?.lastEntityStagePing || 0) > 12000) {
    maybeEntityMessage();
  }
  if (!state.chat.flags) state.chat.flags = {};
  state.chat.flags.lastEntityStagePing = now;
  triggerEntityImpact(true);
  saveGame();
}

function syncStage(quiet = false) {
  const stageIndex = resolveStageIndex();
  const stage = STAGES[stageIndex] || STAGES[0];
  const currentIndex = Math.max(0, Math.min(STAGES.length - 1, state.stage?.index ?? 0));
  if (!state.stage || currentIndex !== stageIndex) {
    const prevStage = state.stage
      ? { ...STAGES[currentIndex], index: currentIndex }
      : null;
    state.stage = { id: stage.id, name: stage.name, index: stageIndex, at: Date.now() };
    if (state.story) {
      state.story.arcStage = stage.id;
      state.story.updatedAt = Date.now();
    }
    applyStageUI(stage);
    if (!quiet) handleStageTransition(prevStage, stage);
  } else {
    applyStageUI(stage);
  }
}

function triggerEntityImpact(strong = false) {
  if (!document.body) return;
  const now = Date.now();
  if (!strong && now - lastEntityImpactAt < ENTITY_IMPACT_COOLDOWN_MS) return;
  lastEntityImpactAt = now;
  if (entityImpactTimer) clearTimeout(entityImpactTimer);
  document.body.classList.add("entity-impact");
  if (strong) {
    document.body.classList.add("entity-impact-strong");
  }
  const duration = strong ? 1400 : 900;
  entityImpactTimer = setTimeout(() => {
    document.body.classList.remove("entity-impact");
    document.body.classList.remove("entity-impact-strong");
  }, duration);
}

function getOperatorTitle() {
  return state?.story?.title || "Operator";
}

function applyStoryPresentation() {
  if (!document.body) return;
  document.body.classList.toggle("endless-mode", !!state.story?.endlessUnlocked);
  document.body.dataset.title = getOperatorTitle();
  const upper = getOperatorTitle().toUpperCase();
  chatSources.operator.user = upper;
  chatSources.entity.user = upper;
  chatSources.entity.id = state.story?.endlessUnlocked ? "WD-000" : "OP-000";
  chatSources.operator.id = state.story?.endlessUnlocked ? "WD-001" : "OP-001";
  if (state.story?.endlessUnlocked && state.playerName === "Operator") {
    state.playerName = state.story.title;
  }
}

function checkEndlessUnlock() {
  if (!state.story) state.story = createDefaultStory();
  if (state.story.endlessUnlocked) return;
  const prestiges = Math.max(0, state.stats?.prestiges || 0);
  if (prestiges < 50) return;
  triggerContainmentEnding();
}

function triggerContainmentEnding() {
  if (!state.story) state.story = createDefaultStory();
  if (state.story.endlessUnlocked) return;

  state.story.endlessUnlocked = true;
  state.story.title = "Warden";
  state.story.uiMode = "endless";
  state.story.unlockedAt = Date.now();
  state.story.updatedAt = Date.now();

  if (state.playerName && state.playerName === "Operator") {
    state.playerName = state.story.title;
  }

  applyStoryPresentation();
  setStatus("Containment active // Warden protocol", { priority: 4, holdMs: 12000 });
  insertChatDivider("containment protocol");
  logOpsEvent("containment protocol engaged", "entity");
  logOpsEvent("infected signal routed to quarantine", "entity");
  logOpsEvent("warden authority granted", "entity");

  const context = buildNpcContext({ title: state.story.title });
  const entityLine = pickLine(npcLibrary.entityContainment || [], context, { allowRapid: true, repeatWindow: 12000 });
  if (entityLine) {
    logChatEvent(chatSources.entity, formatNpcText(entityLine, chatSources.entity, context), { forceScroll: true });
  }

  const npcLine = pickLine(npcLibrary.npcContainment || [], context, { allowRapid: true, repeatWindow: 12000 });
  if (npcLine) {
    const voice = pick(npcVoices);
    sendNpcChat(voice, formatNpcText(npcLine, voice, context), { tone: "warning", allowRapid: true });
  }

  saveGame();
}

function mergeChatState(base, saved) {
  const history = Array.isArray(saved.history) ? saved.history.slice(-CHAT_HISTORY_LIMIT) : [];
  return {
    ...base,
    ...saved,
    runCount: saved.runCount || 0,
    lastClickTs: saved.lastClickTs || 0,
    lastRunFlush: saved.lastRunFlush || Date.now(),
    lastNpcWhisper: saved.lastNpcWhisper || 0,
    history: history.map((entry) => ({
      ts: Number(entry.ts) || Date.now(),
      id: String(entry.id || "s000").slice(0, 8),
      user: String(entry.user || "system").slice(0, 32),
      category: entry.category || "system",
      text: String(entry.text || ""),
      color: entry.color || null,
      tone: entry.tone || null,
      type: entry.type === "divider" ? "divider" : "line"
    })),
    flags: { npcProgress: {}, ...(saved.flags || {}) }
  };
}

function loadGame() {
  const base = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const decoded = decodeSave(raw);
    if (!isValidSignature(decoded)) {
      base.status = "Integrity check failed; save reset";
      base.integrityFlag = true;
      return base;
    }
    return mergeState(base, decoded);
  } catch (err) {
    return base;
  }
}

function saveGame() {
  state.lastSave = Date.now();
  try {
    const signature = computeSignature(snapshotForSignature(state));
    const toStore = { ...state, signature };
    const packed = encodeSave(toStore);
    localStorage.setItem(STORAGE_KEY, packed);
  } catch (err) {
    // ignore storage errors quietly
  }
}

function setupExitSave() {
  window.addEventListener("pagehide", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveGame();
  });
}

function encodeSave(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function decodeSave(str) {
  return JSON.parse(decodeURIComponent(escape(atob(str))));
}

function snapshotForSignature(s) {
  const sigValue = (value) => (isBN(value) ? bnToSave(value) : value);
  return {
    version: GAME_VERSION,
    manualDifficulty: s.manualDifficulty,
    globalUpgrades: s.globalUpgrades,
    prestige: { points: sigValue(s.prestige.points), upgrades: s.prestige.upgrades },
    tiers: s.tiers.map((t) => ({
      amount: sigValue(t.amount),
      autoLevel: t.autoLevel,
      efficiencyLevel: t.efficiencyLevel,
      unlocked: t.unlocked
    })),
    achievements: s.achievements,
    stats: s.stats
  };
}

function computeSignature(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function isValidSignature(saveObj) {
  if (!saveObj || !saveObj.signature) return false;
  try {
    const snap = snapshotForSignature(saveObj);
    return computeSignature(snap) === saveObj.signature;
  } catch {
    return false;
  }
}

function setupTooltips() {
  if (!ui.tooltipLayer || ui.tooltipLayer.dataset.bound) return;
  ui.tooltipLayer.dataset.bound = "true";
  ui.tooltipLayer.style.left = "-9999px";
  ui.tooltipLayer.style.top = "-9999px";

  const schedulePosition = () => {
    if (tooltipMoveRaf) return;
    tooltipMoveRaf = requestAnimationFrame(() => {
      tooltipMoveRaf = null;
      if (tooltipTarget) positionTooltip(tooltipTarget);
    });
  };

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".has-tip");
    if (!target || !target.dataset.tip) return;
    tooltipTarget = target;
    showTooltip(target.dataset.tip);
    schedulePosition();
  });

  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest(".has-tip");
    if (!target || target !== tooltipTarget) return;
    const related = e.relatedTarget;
    if (related && target.contains(related)) return;
    hideTooltip();
  });

  document.addEventListener("mousemove", () => {
    if (tooltipTarget) schedulePosition();
  });

  window.addEventListener("scroll", () => {
    if (tooltipTarget) schedulePosition();
  }, true);

  window.addEventListener("resize", () => {
    if (tooltipTarget) schedulePosition();
  });
}

function showTooltip(text) {
  if (!ui.tooltipLayer) return;
  ui.tooltipLayer.textContent = text;
  ui.tooltipLayer.classList.add("visible");
}

function hideTooltip() {
  if (!ui.tooltipLayer) return;
  ui.tooltipLayer.classList.remove("visible");
  ui.tooltipLayer.style.left = "-9999px";
  ui.tooltipLayer.style.top = "-9999px";
  tooltipTarget = null;
}

function positionTooltip(target) {
  if (!ui.tooltipLayer || !target) return;
  const rect = target.getBoundingClientRect();
  const tip = ui.tooltipLayer;
  const gap = 8;
  const tipRect = tip.getBoundingClientRect();
  const dir =
    target.dataset.tipDir ||
    (target.classList.contains("tip-right")
      ? "right"
      : target.classList.contains("tip-left")
        ? "left"
        : target.classList.contains("tip-bottom")
          ? "bottom"
          : target.classList.contains("tip-top")
            ? "top"
            : "top");

  let top = rect.top;
  let left = rect.left;

  if (dir === "right") {
    top = rect.top + (rect.height - tipRect.height) / 2;
    left = rect.right + gap;
    if (left + tipRect.width > window.innerWidth - 8) {
      left = rect.left - tipRect.width - gap;
    }
  } else if (dir === "left") {
    top = rect.top + (rect.height - tipRect.height) / 2;
    left = rect.left - tipRect.width - gap;
    if (left < 8) {
      left = rect.right + gap;
    }
  } else if (dir === "bottom") {
    top = rect.bottom + gap;
    left = rect.left;
    if (top + tipRect.height > window.innerHeight - 8) {
      top = rect.top - tipRect.height - gap;
    }
  } else {
    top = rect.top - tipRect.height - gap;
    left = rect.left;
    if (top < 8) {
      top = rect.bottom + gap;
    }
  }

  const maxLeft = window.innerWidth - tipRect.width - 8;
  if (left > maxLeft) left = maxLeft;
  if (left < 8) left = 8;
  const maxTop = window.innerHeight - tipRect.height - 8;
  if (top > maxTop) top = maxTop;
  if (top < 8) top = 8;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function initUI() {
  ui.status = document.getElementById("statusLine");
  ui.currency = document.getElementById("currencyDisplay");
  ui.clickValue = document.getElementById("clickValueDisplay");
  ui.rate = document.getElementById("rateDisplay");
  ui.automationPower = document.getElementById("automationPower");
  ui.prestigeMultiplier = document.getElementById("prestigeMultiplier");
  ui.autoBar = document.getElementById("autoBar");
  ui.prestigePoints = document.getElementById("prestigePoints");
  ui.pendingPrestige = document.getElementById("pendingPrestige");
  ui.nextTierLabel = document.getElementById("nextTierLabel");
  ui.unlockTierButton = document.getElementById("unlockTierButton");
  ui.saveData = document.getElementById("saveData");
  ui.sessionTime = document.getElementById("sessionTime");
  ui.upgradeCount = document.getElementById("upgradeCount");
  ui.offlineDisplay = document.getElementById("offlineDisplay");
  ui.infoDetail = document.getElementById("infoDetail");
  ui.difficultyInput = document.getElementById("difficultyInput");
  ui.achievementsButton = document.getElementById("achievementsButton");
  ui.achievementsModal = document.getElementById("achievementsModal");
  ui.achievementsList = document.getElementById("achievementsList");
  ui.achievementsSummary = document.getElementById("achievementsSummary");
  ui.closeAchievements = document.getElementById("closeAchievements");
  ui.toastContainer = document.getElementById("toastContainer");
  ui.difficultyStatus = document.getElementById("difficultyStatus");
  ui.hardModeStatus = document.getElementById("hardModeStatus");
  ui.integrityStatus = document.getElementById("integrityStatus");
  ui.cpsDisplay = document.getElementById("cpsDisplay");
  ui.chatList = document.getElementById("chatList");
  ui.chatInput = document.getElementById("chatInput");
  ui.chatFooterLine = ui.chatInput;
  ui.chatLiveButton = document.getElementById("chatLiveButton");
  ui.chatSendButton = document.getElementById("chatSendButton");
  ui.opsLog = document.getElementById("opsLog");
  ui.opsSection = document.getElementById("opsFeedSection");
  ui.opsToggle = document.getElementById("opsToggle");
  ui.sortUpgradesToggle = document.getElementById("sortUpgradesToggle");
  ui.tooltipLayer = document.getElementById("tooltipLayer");
  ui.buyModeButtons = Array.from(document.querySelectorAll("[data-buy-mode]"));
  ui.panelActionButtons = Array.from(document.querySelectorAll("[data-panel-action]"));
  ui.status.classList.add("pulse");

  document.getElementById("clickButton").addEventListener("click", handleClick);
  document.getElementById("saveButton").addEventListener("click", () => {
    saveGame();
    setStatus("Manual save complete.");
  });
  document.getElementById("exportButton").addEventListener("click", exportSave);
  document.getElementById("importButton").addEventListener("click", importSave);
  document.getElementById("hardResetButton").addEventListener("click", hardReset);
  ui.unlockTierButton.addEventListener("click", unlockNextTier);
  document.getElementById("prestigeButton").addEventListener("click", doPrestige);
  ui.difficultyInput.addEventListener("change", onDifficultyChange);
  ui.achievementsButton.addEventListener("click", toggleAchievementsModal);
  ui.closeAchievements.addEventListener("click", toggleAchievementsModal);
  ui.achievementsModal.addEventListener("click", (e) => {
    if (e.target === ui.achievementsModal) toggleAchievementsModal();
  });

  if (ui.chatList) {
    ui.chatList.addEventListener("scroll", handleChatScroll);
  }
  if (ui.chatLiveButton) {
    ui.chatLiveButton.addEventListener("click", scrollChatToLive);
  }
  if (ui.chatInput) {
    ui.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleChatSend();
      }
    });
  }
  if (ui.chatSendButton) {
    ui.chatSendButton.addEventListener("click", handleChatSend);
  }

  if (ui.sortUpgradesToggle) {
    ui.sortUpgradesToggle.checked = !!state.uiPrefs?.sortUpgradesByCost;
    ui.sortUpgradesToggle.addEventListener("change", (e) => {
      state.uiPrefs.sortUpgradesByCost = !!e.target.checked;
      saveGame();
      render(true);
    });
  }

  if (ui.buyModeButtons.length) {
    ui.buyModeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.buyMode || "1";
        state.uiPrefs.buyMode = mode;
        updateBuyModeUI();
        saveGame();
        render(true);
      });
    });
    updateBuyModeUI();
  }

  if (state.uiPrefs.opsCollapsed == null) state.uiPrefs.opsCollapsed = false;

  if (ui.opsToggle) {
    ui.opsToggle.addEventListener("click", () => {
      setOpsCollapsed(!state.uiPrefs.opsCollapsed);
    });
  }

  if (ui.panelActionButtons.length) {
    ui.panelActionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".panel");
        if (!panel || !panel.dataset.panelId) return;
        const panelId = panel.dataset.panelId;
        const action = btn.dataset.panelAction;
        if (action === "min") {
          togglePanelCollapsed(panelId);
        } else if (action === "max") {
          const group = panel.closest("[data-panel-group]");
          togglePanelMaximized(panelId, group);
        }
      });
    });
    applyPanelStates();
  }

  applyOpsCollapsedUI();
  setupTooltips();

  const globalContainer = document.getElementById("globalUpgrades");
  const gFrag = document.createDocumentFragment();
  globalUpgradeDefs.forEach((def) => {
    const btn = document.createElement("button");
    btn.className = "upgrade has-tip";
    btn.addEventListener("click", () => buyGlobalUpgrade(def));
    gFrag.appendChild(btn);
    globalUpgradeButtons.set(def.id, btn);
  });
  globalContainer.appendChild(gFrag);

  const metaContainer = document.getElementById("metaUpgrades");
  const mFrag = document.createDocumentFragment();
  metaUpgradeDefs.forEach((def) => {
    const btn = document.createElement("button");
    btn.className = "upgrade secondary has-tip";
    btn.addEventListener("click", () => buyMetaUpgrade(def));
    mFrag.appendChild(btn);
    metaUpgradeButtons.set(def.id, btn);
  });
  metaContainer.appendChild(mFrag);

  rebuildTierUI();
}

function rebuildTierUI() {
  tierElements.clear();
  const list = document.getElementById("tiersList");
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  state.tiers.forEach((tier) => {
    const card = buildTierCard(tier);
    frag.appendChild(card);
  });
  list.appendChild(frag);
}

function updateBuyModeUI() {
  if (!ui.buyModeButtons || !ui.buyModeButtons.length) return;
  const mode = getBuyMode();
  ui.buyModeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.buyMode === mode);
  });
}

function getPanelState(panelId) {
  if (!state.uiPrefs) state.uiPrefs = {};
  if (!state.uiPrefs.panels || typeof state.uiPrefs.panels !== "object") {
    state.uiPrefs.panels = {};
  }
  if (!state.uiPrefs.panels[panelId]) {
    state.uiPrefs.panels[panelId] = { collapsed: false, maximized: false };
  }
  return state.uiPrefs.panels[panelId];
}

function togglePanelCollapsed(panelId) {
  const panelState = getPanelState(panelId);
  panelState.collapsed = !panelState.collapsed;
  if (panelState.collapsed) panelState.maximized = false;
  applyPanelStates();
  saveGame();
}

function togglePanelMaximized(panelId, groupEl) {
  const panelState = getPanelState(panelId);
  const nextMax = !panelState.maximized;
  if (nextMax && groupEl) {
    const groupPanels = Array.from(groupEl.querySelectorAll(".panel[data-panel-id]"));
    groupPanels.forEach((panel) => {
      const otherId = panel.dataset.panelId;
      if (!otherId) return;
      const stateRef = getPanelState(otherId);
      stateRef.maximized = false;
    });
    panelState.collapsed = false;
  }
  panelState.maximized = nextMax;
  applyPanelStates();
  saveGame();
}

function applyPanelStates() {
  const panels = Array.from(document.querySelectorAll(".panel[data-panel-id]"));
  const groupMap = new Map();

  panels.forEach((panel) => {
    const panelId = panel.dataset.panelId;
    if (!panelId) return;
    const panelState = getPanelState(panelId);

    const group = panel.closest("[data-panel-group]");
    if (group) {
      const groupId = group.dataset.panelGroup || "__default__";
      const entry = groupMap.get(groupId) || { group, maxPanelId: null };
      if (panelState.maximized) {
        if (!entry.maxPanelId) {
          entry.maxPanelId = panelId;
        } else {
          panelState.maximized = false;
        }
      }
      groupMap.set(groupId, entry);
    }

    panel.classList.toggle("is-collapsed", !!panelState.collapsed);
    panel.classList.toggle("is-maximized", !!panelState.maximized);

    const minBtn = panel.querySelector("[data-panel-action='min']");
    if (minBtn) {
      minBtn.setAttribute("aria-label", panelState.collapsed ? "Restore" : "Minimize");
    }
    const maxBtn = panel.querySelector("[data-panel-action='max']");
    if (maxBtn) {
      maxBtn.setAttribute("aria-label", panelState.maximized ? "Restore" : "Maximize");
    }
  });

  groupMap.forEach(({ group, maxPanelId }) => {
    group.classList.toggle("column-maximized", !!maxPanelId);
    if (maxPanelId) group.dataset.maxPanel = maxPanelId;
    else group.removeAttribute("data-max-panel");
  });
}

function setOpsCollapsed(collapsed) {
  if (!state.uiPrefs) state.uiPrefs = {};
  state.uiPrefs.opsCollapsed = !!collapsed;
  applyOpsCollapsedUI();
  saveGame();
}

function applyOpsCollapsedUI() {
  const opsCollapsed = !!state.uiPrefs?.opsCollapsed;
  if (ui.opsSection) ui.opsSection.classList.toggle("collapsed", opsCollapsed);
  if (ui.opsToggle) {
    ui.opsToggle.textContent = opsCollapsed ? "Show" : "Hide";
    ui.opsToggle.setAttribute("aria-expanded", String(!opsCollapsed));
  }
}

function buildTierCard(tier) {
  const card = document.createElement("div");
  card.className = "tier-card";

  const header = document.createElement("div");
  header.className = "tier-header";

  const name = document.createElement("div");
  name.textContent = `${tier.name} [T${tier.index}]`;

  const amount = document.createElement("div");
  amount.className = "value mono";

  header.append(name, amount);

  const body = document.createElement("div");
  body.className = "tier-body";

  const rate = document.createElement("div");
  rate.className = "muted mono";
  rate.textContent = "Rate: 0/s";

  const btnRow = document.createElement("div");
  btnRow.className = "button-row";

  let buyBtn = null;

  // === ACQUIRE BUTTON (manual buy) ===
  if (tier.index > 0) {
    buyBtn = document.createElement("button");
    buyBtn.className = "small has-tip";

    if (isFrontierTier(tier)) {
      buyBtn.addEventListener("click", () => buyTierUnit(tier));
    } else {
      buyBtn.disabled = true;
      buyBtn.textContent = "Acquire Locked";
      buyBtn.title = "Manual acquisition is disabled once the next tier is unlocked";
    }

    btnRow.appendChild(buyBtn);
  }

  const autoBtn = document.createElement("button");
  autoBtn.className = "small secondary has-tip";
  autoBtn.addEventListener("click", () => buyTierUpgrade(tier, "auto"));

  const effBtn = document.createElement("button");
  effBtn.className = "small secondary has-tip";
  effBtn.addEventListener("click", () => buyTierUpgrade(tier, "eff"));

  btnRow.append(autoBtn, effBtn);
  body.append(rate, btnRow);
  card.append(header, body);

  tierElements.set(tier.id, { card, amount, rate, buyBtn, autoBtn, effBtn });
  return card;
}

function applyOfflineProgress() {
  const now = Date.now();
  const elapsed = Math.max(0, Math.min((now - state.lastTick) / 1000, MAX_OFFLINE_SECONDS));
  if (elapsed > 1) {
    const before = state.tiers[0].amount;
    applyIncome(elapsed * getOfflineMultiplier());
    const gain = bnSub(state.tiers[0].amount, before);
    state.offlineSummary = { gain, seconds: elapsed };
    setStatus(`Offline gains: +${formatNumber(gain)} credits over ${formatNumber(elapsed)}s`);
    logChatEvent(chatSources.system, `offline applied: +${formatNumber(gain)} credits in ${formatNumber(elapsed)}s`, { ts: now });
  } else {
    setStatus(state.status || "Online");
  }
  state.lastTick = now;
}

function handleClick() {
  recordPlayerAction();
  // First-ever click: NPC greeting only, no other reactions
  if (!state.chat.flags.greeted) {
    triggerNpcGreeting();
    return;
  }

  const now = Date.now();
  const idleGap = now - (state.lastClickTime || 0);
  // start grace after an idle gap
  if (idleGap > 5000) {
    state.cpsGraceUntil = now + 3000;
  }
  state.lastClickTime = now;

  state.clickHistory = (state.clickHistory || []).filter((t) => now - t < 2500);
  state.clickHistory.push(now);
  const timeSpan = (now - state.clickHistory[0]) / 1000;
  const cps = timeSpan >= 1 ? state.clickHistory.length / timeSpan : state.clickHistory.length; state.lastCps = cps;
  const threshold = 10; // cps threshold
  const inGrace = now < state.cpsGraceUntil;
  if (!inGrace) {
    if (cps > threshold) {
      const excess = cps - threshold;
      const factor = Math.max(0.01, 1 - excess * 0.05); // ramps down to 1%
      state.penaltyScale = Math.max(0.01, Math.min(state.penaltyScale, factor));
    } else {
      // recover steadily when under threshold
      state.penaltyScale = Math.min(1, state.penaltyScale + 0.08);
    }
  } else {
    // during grace, recover toward full
    state.penaltyScale = Math.min(1, state.penaltyScale + 0.1);
  }
  const gain = getClickValue() * state.penaltyScale;
  addCurrency(gain);
  state.stats.clicks += 1;
  setStatus(`Manual input ${state.penaltyScale < 1 ? "(reduced)" : ""} +${formatNumber(gain)}`);
  logClickRun(now);
  notePenaltyState();
  maybeNpcFirstClick();
  render();
}

function addCurrency(amount) {
  const delta = bn(amount);
  state.tiers[0].amount = bnAdd(state.tiers[0].amount, delta);
  state.totalCurrency = bnAdd(state.totalCurrency, delta);
  if (!state.hardModeStarted && bnCmp(state.totalCurrency, bnFromNumber(1000)) >= 0) {
    state.hardModeStarted = true;
    state.hardModeValid = state.manualDifficulty === 100;
  } else if (state.hardModeStarted && state.hardModeValid && state.manualDifficulty !== 100) {
    state.hardModeValid = false;
  }
}

function totalUpgradeLoad() {
  const globalCount = Object.values(state.globalUpgrades).reduce((a, b) => a + b, 0);
  const tierLoad = state.tiers.reduce((acc, t) => acc + t.autoLevel + t.efficiencyLevel, 0);
  const metaCount = Object.values(state.prestige.upgrades).reduce((a, b) => a + b, 0);
  return globalCount + tierLoad + metaCount + state.tiers.length * 1.75;
}

function getProgressionWall() {
  const t = state.tiers.length - 1;
  if (t <= 2) return 1;
  return Math.pow(1.6, t - 2);
}

function getManualCostFactor() {
  return getDifficultyScalar();
}

function getManualIncomeFactor() {
  const d = state.manualDifficulty || 1;
  return Math.max(0.0001, 1 - d / 100);
}

function getDifficultyScalar() {
  // state.difficulty is 1–100 from the UI
  const base = 1 + (state.manualDifficulty - 1) * 0.01;
  const softener = 1 - (state.prestige.upgrades.difficultySoftener || 0) * 0.04;
  return base * Math.max(0.6, softener);
}

function isFrontierTier(tier) {
  return tier.index === state.tiers.length - 1;
}

function getIncomeDampener() {
  const depth = state.tiers.length - 1;
  const tierDrag = 1 + Math.max(0, depth - 2) * 0.05;
  const upgradeDrag = 1 + Math.max(0, totalUpgradeLoad() - 5) * 0.012;
  return Math.max(0.08, 1 / (tierDrag * upgradeDrag));
}

function getGlobalMultiplier() {
  const overclock = 1 + state.globalUpgrades.overclock * 0.03;
  const buffer = 1 + state.globalUpgrades.buffer * 0.02;
  return overclock * buffer * getIncomeDampener();
}

function getPrestigeMultiplier() {
  const points = bn(state.prestige.points);
  const prestiges = Math.max(0, state.stats?.prestiges || 0);
  const boostLvl = Math.max(0, state.prestige.upgrades?.prestigeBoost || 0);

  const logPoints = Math.max(0, bnLog10(bnAdd(points, bnFromNumber(1))));
  const baseCap = 1.6 + prestiges * 0.03;
  const pointBonus = Math.min(baseCap, logPoints * 0.18);
  const upgradeBonus = boostLvl * 0.04;

  return 1 + pointBonus + upgradeBonus;
}


function getAutomationMultiplier() {
  return 1 + state.globalUpgrades.automation * 0.12 + state.prestige.upgrades.autoPersist * 0.1;
}

function tierEfficiencyMultiplier(tier) {
  return (1 + tier.efficiencyLevel * 0.18) * (1 + state.globalUpgrades.buffer * 0.02);
}

function getClickValue() {
  const base = 1 + state.globalUpgrades.click * 0.8 + state.globalUpgrades.clickBurst * 0.4;
  const meta = 1 + state.prestige.upgrades.clickPersist * 0.15;
  const eff0 = tierEfficiencyMultiplier(state.tiers[0]);
  return base * meta * getPrestigeMultiplier() * eff0 * getManualIncomeFactor();
}

function baseAutoPerSecond() {
  const t0 = state.tiers[0];
  const autoMult = getAutomationMultiplier();
  const eff0 = tierEfficiencyMultiplier(t0);
  const additive = state.globalUpgrades.threads * 0.2;
  const base = t0.autoLevel * (0.38 + state.globalUpgrades.automation * 0.03) + additive;
  return bnFromNumber(base * autoMult * eff0 * getPrestigeMultiplier() * getGlobalMultiplier() * getManualIncomeFactor());
}

function estimateBaseRate() {
  let rate = baseAutoPerSecond();
  if (state.tiers[1]) {
    rate = bnAdd(rate, tierProductionPerSecond(state.tiers[1]));
  }
  return rate;
}

function tierProductionPerSecond(tier) {
  if (!tier || tier.index === 0) return bnZero();
  const lower = state.tiers[tier.index - 1];
  if (!lower) return bnZero();
  const eff = tierEfficiencyMultiplier(tier);
  const rate =
    tier.baseRate *
    (1 + tier.autoLevel) *
    eff *
    getAutomationMultiplier() *
    getPrestigeMultiplier() *
    getGlobalMultiplier() *
    getManualIncomeFactor();
  return bnMulScalar(tier.amount, rate);
}

function computePrestigeRate() {
  const baseRate = estimateBaseRate();
  const depth = state.tiers.length - 1;
  const prestiges = Math.max(0, state.stats?.prestiges || 0);
  const totalWealth = bnAdd(state.totalCurrency, state.tiers[0].amount);
  const wealthLog = Math.max(0, bnLog10(totalWealth) - 2);
  const autoLog = Math.max(0, bnLog10(baseRate) - 1);
  const runSeconds = secondsSincePrestige();
  const fatigueWindow = 1800 + prestiges * 240;
  const fatigue = 1 / (1 + Math.pow(runSeconds / Math.max(1, fatigueWindow), 1.1));
  const prestigePenalty = 1 / (1 + prestiges * 0.14);
  const slow = 1 + getDifficultyScalar() * 0.65 + totalUpgradeLoad() * 0.055;
  const earlyBoost = prestiges === 0 ? 1.28 : prestiges < 3 ? 1.12 : 1.03;
  return (
    (wealthLog * 0.0046 + depth * 0.00052 + autoLog * 0.00125) *
    fatigue *
    prestigePenalty *
    earlyBoost /
    slow
  );
}

function getOfflineMultiplier() {
  return 1 + state.prestige.upgrades.offlineBoost * 0.08;
}

function applyIncome(delta) {
  const autoGain = bnMulScalar(baseAutoPerSecond(), delta);
  if (bnCmp(autoGain, bnZero()) > 0) addCurrency(autoGain);

  for (let i = state.tiers.length - 1; i >= 1; i--) {
    const tier = state.tiers[i];
    if (!tier.unlocked || bnCmp(tier.amount, bnZero()) <= 0) continue;
    const lower = state.tiers[i - 1];
    const perSec = tierProductionPerSecond(tier);
    const gained = bnMulScalar(perSec, delta);
    lower.amount = bnAdd(lower.amount, gained);
    if (i === 1) {
      state.totalCurrency = bnAdd(state.totalCurrency, gained);
    }
  }

  const prestigeRate = computePrestigeRate();
  state.prestige.pending = bnAdd(state.prestige.pending, bnFromNumber(prestigeRate * delta));
}

function tierUnitCost(tier) {
  const growth = bnPowFromBigExp(tier.costGrowth, tier.amount);
  return bnMulScalar(growth, tier.baseCost * getDifficultyScalar());
}


function tierUpgradeCost(tier, kind) {
  const level = kind === "auto" ? tier.autoLevel : tier.efficiencyLevel;
  const base = kind === "auto" ? tier.autoCostBase : tier.effCostBase;
  const growth = kind === "auto" ? 1.95 : 2.05;

  return bnFromNumber(
    base *
    Math.pow(growth, level) *
    getDifficultyScalar()
  );
}



function tierUnlockCost(index) {
  // Static tier unlock costs, paid in previous-tier currency
  // Only manualDifficulty scales the result

  if (index <= 0) return bnZero();

  let base;

  if (index === 1) {
    // Credits → Scripts
    base = bnFromNumber(1200);
  } else {
    // Scripts → Daemons starts the x4 chain
    base = bnMulScalar(bnPowScalar(5, index - 2), 40);
  }

  const scaled = index <= 5 ? bnMulScalar(base, 0.85) : base;
  return bnMulScalar(scaled, state.manualDifficulty);
}

function getTierAcquireCost(tier) {
  // If this tier is no longer frontier, freeze cost at unlock-time value
  if (!isFrontierTier(tier)) {
    return tier._lockedAcquireCost ?? tierUnitCost(tier);
  }
  return tierUnitCost(tier);
}


function buyTierUnit(tier) {
  const payer = state.tiers[tier.index - 1];
  const mode = getBuyMode();
  const costFor = (count) =>
    seriesCostFromExp(tier.baseCost, tier.costGrowth, tier.amount, count, getDifficultyScalar());
  const buyCount = getAffordableBuyCount(mode, payer.amount, costFor);

  if (buyCount <= 0) {
    const costOne = costFor(1);
    setStatus(`Insufficient ${payer.name}: need ${formatNumber(bnSub(costOne, payer.amount))}`);
    return;
  }

  const totalCost = costFor(buyCount);
  payer.amount = bnSub(payer.amount, totalCost);
  tier.amount = bnAdd(tier.amount, bnFromNumber(buyCount));
  recordPlayerAction();
  setStatus(`Acquired ${buyCount} ${tier.name}`);
  saveGame();
  logOpsEvent(
    `+${formatNumber(bnFromNumber(buyCount))} ${tier.name} (spent ${formatNumber(totalCost)} ${payer.name})`,
    "tier"
  );
}


function buyTierUpgrade(tier, type) {
  const payer = state.tiers[Math.max(0, tier.index - 1)];
  const level = type === "auto" ? tier.autoLevel : tier.efficiencyLevel;
  const base = type === "auto" ? tier.autoCostBase : tier.effCostBase;
  const growth = type === "auto" ? 1.95 : 2.05;
  const mode = getBuyMode();
  const costFor = (count) => seriesCostFromLevel(base, growth, level, count, getDifficultyScalar());
  const buyCount = getAffordableBuyCount(mode, payer.amount, costFor);

  if (buyCount <= 0) {
    const costOne = costFor(1);
    setStatus(`Need ${formatNumber(bnSub(costOne, payer.amount))} more ${payer.name}`);
    return;
  }

  const totalCost = costFor(buyCount);
  payer.amount = bnSub(payer.amount, totalCost);
  if (type === "auto") tier.autoLevel += buyCount;
  else tier.efficiencyLevel += buyCount;
  recordPlayerAction();
  setStatus(`${tier.name} ${type === "auto" ? "automation" : "efficiency"} upgraded x${buyCount}`);
  saveGame();
  const newLevel = type === "auto" ? tier.autoLevel : tier.efficiencyLevel;
  logOpsEvent(
    `${tier.name} ${type === "auto" ? "Automation" : "Efficiency"} -> Lv${newLevel} (+${formatNumber(bnFromNumber(buyCount))}) (spent ${formatNumber(totalCost)} ${payer.name})`,
    "tier"
  );
}

function buyGlobalUpgrade(def) {
  const level = state.globalUpgrades[def.id];
  const mode = getBuyMode();
  const costFor = (count) =>
    seriesCostFromLevel(def.baseCost, def.costGrowth, level, count, getDifficultyScalar());
  const buyCount = getAffordableBuyCount(mode, state.tiers[0].amount, costFor);

  if (buyCount <= 0) {
    const costOne = costFor(1);
    setStatus(`Unaffordable: need ${formatNumber(bnSub(costOne, state.tiers[0].amount))} credits`);
    return;
  }

  const totalCost = costFor(buyCount);
  state.tiers[0].amount = bnSub(state.tiers[0].amount, totalCost);
  state.globalUpgrades[def.id] += buyCount;
  recordPlayerAction();
  setStatus(`${def.name} upgraded to ${state.globalUpgrades[def.id]} (x${buyCount})`);
  saveGame();
  logOpsEvent(
    `${def.name} -> Lv${state.globalUpgrades[def.id]} (+${formatNumber(bnFromNumber(buyCount))}) (spent ${formatNumber(totalCost)} cr)`,
    "upgrade"
  );
  maybeNpcFirstUpgrade();
}

function buyMetaUpgrade(def) {
  const level = state.prestige.upgrades[def.id] || 0;
  const mode = getBuyMode();
  const costFor = (count) => seriesCostFromLevel(def.baseCost, def.costGrowth, level, count, 1);
  const buyCount = getAffordableBuyCount(mode, state.prestige.points, costFor);

  if (buyCount <= 0) {
    setStatus("Not enough prestige points");
    return;
  }

  const totalCost = costFor(buyCount);
  state.prestige.points = bnSub(state.prestige.points, totalCost);
  state.prestige.upgrades[def.id] = level + buyCount;
  recordPlayerAction();
  setStatus(`${def.name} upgraded to ${level + buyCount} (x${buyCount})`);
  saveGame();
  logOpsEvent(
    `${def.name} -> Lv${level + buyCount} (+${formatNumber(bnFromNumber(buyCount))}) (spent ${formatNumber(totalCost)} prestige)`,
    "prestige"
  );
}

function unlockNextTier() {
  const nextIndex = state.tiers.length;
  if (nextIndex > 100) {
    setStatus("Tier cap reached");
    return;
  }
  const prevTier = state.tiers[nextIndex - 1];
  // Freeze manual acquire cost for the previous tier
  if (prevTier._lockedAcquireCost == null) {
    prevTier._lockedAcquireCost = tierUnitCost(prevTier);
  }

  const cost = tierUnlockCost(nextIndex);
  if (bnCmp(prevTier.amount, cost) < 0) {
    setStatus(`Need ${formatNumber(bnSub(cost, prevTier.amount))} more ${prevTier.name} to unlock`);
    return;
  }
  prevTier.amount = bnSub(prevTier.amount, cost);
  const newTier = makeTier(nextIndex);
  newTier.unlocked = true;
  newTier.amount = bnFromNumber(1);
  state.tiers.push(newTier);
  recordPlayerAction();
  document.getElementById("tiersList").appendChild(buildTierCard(newTier));
  setStatus(`Unlocked ${newTier.name}`);
  insertChatDivider(`T${nextIndex} // ${newTier.name}`);
  logChatEvent(chatSourceForTier(newTier), `Unlocked using ${formatNumber(cost)} ${prevTier.name}`);
  maybeNpcTierUnlock(newTier);
  saveGame();
  render(true);
}

function secondsSincePrestige() {
  const t = state?.prestige?.lastRebootAt;
  if (!t) return 0;
  return (Date.now() - t) / 1000;
}

function doPrestige() {
  const gained = bnFloor(state.prestige.pending);
  const required = state.prestige.minRequired || 12;

  if (bnCmp(gained, bnFromNumber(required)) < 0) {
    setStatus(`Need at least ${required} prestige to reboot`);
    return;
  }

  recordPlayerAction();
  flushClickRun();
  const prevStage = state.stage;
  const prevChat = state.chat;
  const prevStats = state.stats;
  const prevDifficulty = state.manualDifficulty;
  const prevAchievements = state.achievements;
  const prevStory = state.story;
  const upgrades = { ...state.prestige.upgrades };
  const totalPoints = bnAdd(state.prestige.points, gained);
  state = createDefaultState();
  if (prevStage) state.stage = prevStage;
  state.story = mergeStoryState(createDefaultStory(), prevStory || {});
  state.chat = mergeChatState(createDefaultChatState(), prevChat || {});
  state.prestige.points = totalPoints;
  state.prestige.upgrades = upgrades;
  state.prestige.pending = bnZero();
  state.status = `Rebooted for +${formatNumber(gained)} prestige`;
  state.stats = prevStats;
  state.stats.prestiges += 1;
  // Increase minimum required prestige for next reboot
  const growth = 1.22 + Math.min(0.18, state.stats.prestiges * 0.003);
  const bump = 1 + Math.max(0, state.stats.prestiges - 5) * 0.015;
  state.prestige.minRequired = Math.ceil(required * growth * bump);

  state.manualDifficulty = prevDifficulty;
  state.achievements = prevAchievements;
  state.prestige.lastRebootAt = Date.now();
  applyStoryPresentation();
  insertChatDivider("reboot");
  logChatEvent(chatSources.prestige, `Rebooted +${formatNumber(gained)} (total ${formatNumber(state.prestige.points)})`);
  maybeNpcPrestige(gained);
  maybeEntityMessage();
  maybeDevTip();
  syncStage(false);
  rebuildTierUI();
  render(true);
  saveGame();
}

function exportSave() {
  try {
    const signature = computeSignature(snapshotForSignature(state));
    const packed = encodeSave({ ...state, signature });
    ui.saveData.value = packed;
    ui.saveData.select();
    setStatus("Exported save code");
    logChatEvent(chatSources.system, "save exported");
  } catch (err) {
    setStatus("Export failed");
  }
}

function importSave() {
  const code = ui.saveData.value.trim();
  if (!code) {
    setStatus("No code to import");
    return;
  }
  try {
    const parsed = decodeSave(code);
    if (!isValidSignature(parsed)) {
      setStatus("Import failed integrity");
      logChatEvent(chatSources.integrity, "import rejected (integrity failed)");
      return;
    }
    state = mergeState(createDefaultState(), parsed);
    state.lastTick = Date.now();
    applyStoryPresentation();
    rebuildTierUI();
    applyOpsCollapsedUI();
    applyPanelStates();
    setStatus("Import successful");
    logChatEvent(chatSources.system, "imported save (verified)");
    render(true);
    saveGame();
  } catch (err) {
    setStatus("Import failed");
    logChatEvent(chatSources.warning, "import failed: unreadable code");
  }
}

function hardReset() {
  const confirmed = confirm("Hard reset all progress to 0, including reboots. This cannot be undone.");
  if (!confirmed) return;
  state = createDefaultState();
  applyStoryPresentation();
  rebuildTierUI();
  applyOpsCollapsedUI();
  applyPanelStates();
  render(true);
  saveGame();
  setStatus("System wiped");
  insertChatDivider("reset");
  logChatEvent(chatSources.warning, "hard reset executed");
}

function render(force = false) {
  if (!force) {
    const now = Date.now();
    if (now - lastRender < RENDER_INTERVAL_MS) return;
    lastRender = now;
  }

  ui.currency.textContent = formatNumber(state.tiers[0].amount);
  ui.clickValue.textContent = `+${formatNumber(getClickValue())}`;
  ui.rate.textContent = `${formatNumber(estimateBaseRate())}/s`;
  ui.automationPower.textContent = `x${getAutomationMultiplier().toFixed(2)}`;
  ui.prestigeMultiplier.textContent = `x${getPrestigeMultiplier().toFixed(2)}`;
  if (ui.difficultyInput && document.activeElement !== ui.difficultyInput) {
    ui.difficultyInput.value = state.manualDifficulty || 1;
  }
  if (ui.sortUpgradesToggle) ui.sortUpgradesToggle.checked = !!state.uiPrefs?.sortUpgradesByCost;
  updateBuyModeUI();
  renderAchievements();

  const autoMult = getAutomationMultiplier();
  const fill = Math.min(1, (autoMult - 1) / 3);
  const speedFactor =
    state.tiers[0].autoLevel * 0.15 +
    state.globalUpgrades.automation * 0.1 +
    state.globalUpgrades.threads * 0.05;
  const effectiveSpeed = Math.max(0, speedFactor * autoMult - 0.05);
  const period =
    effectiveSpeed <= 0
      ? Infinity
      : Math.max(800, 480000 / Math.max(1, effectiveSpeed * 10));
  const staticFast = period <= 200;
  const animate = period < Infinity && !staticFast;
  const phase = animate ? ((Date.now() % period) / period) : 0;
  ui.autoBar.textContent = buildAsciiBar(fill, phase, staticFast);
  ui.autoBar.classList.toggle("animated", animate);
  ui.autoBar.classList.toggle("fast", staticFast);

  globalUpgradeDefs.forEach((def, idx) => {
    const btn = globalUpgradeButtons.get(def.id);
    const level = state.globalUpgrades[def.id];
    const mode = getBuyMode();
    const costFor = (count) =>
      seriesCostFromLevel(def.baseCost, def.costGrowth, level, count, getDifficultyScalar());
    const buyCount = getAffordableBuyCount(mode, state.tiers[0].amount, costFor);
    const displayCount = buyCount > 0 ? buyCount : 1;
    const cost = costFor(displayCount);
    const label = buyLabel(mode, buyCount);
    btn.textContent = `${def.name} [Lv${level}]${label} Cost: ${formatNumber(cost)} cr`;
    btn.dataset.tip = `${def.desc}`;
    const affordable = buyCount > 0;
    btn.disabled = !affordable;
    toggleDisabled(btn, !affordable);
    btn.style.order = state.uiPrefs?.sortUpgradesByCost ? orderFromCost(cost, idx) : idx;
  });

  metaUpgradeDefs.forEach((def, idx) => {
    const btn = metaUpgradeButtons.get(def.id);
    const level = state.prestige.upgrades[def.id] || 0;
    const mode = getBuyMode();
    const costFor = (count) => seriesCostFromLevel(def.baseCost, def.costGrowth, level, count, 1);
    const buyCount = getAffordableBuyCount(mode, state.prestige.points, costFor);
    const displayCount = buyCount > 0 ? buyCount : 1;
    const cost = costFor(displayCount);
    const label = buyLabel(mode, buyCount);
    btn.textContent = `${def.name} [Lv${level}]${label} Cost: ${formatNumber(cost)} prestige`;
    btn.dataset.tip = `${def.desc}\nPermanent meta bonus.`;
    const affordable = buyCount > 0;
    btn.disabled = !affordable;
    toggleDisabled(btn, !affordable);
    btn.style.order = state.uiPrefs?.sortUpgradesByCost ? orderFromCost(cost, idx) : idx;
  });

  ui.prestigePoints.textContent = `${formatNumber(state.prestige.points)} (x${getPrestigeMultiplier().toFixed(2)})`;
  ui.pendingPrestige.textContent = `${formatNumber(state.prestige.pending)} pending`;

  const visibleStart = Math.max(0, state.tiers.length - 6);
  state.tiers.forEach((tier, idx) => {
    const el = tierElements.get(tier.id);
    if (!el) return;
    el.card.style.display = idx >= visibleStart ? "" : "none";
    el.amount.textContent = formatNumber(tier.amount);
    if (idx === 0) {
      el.rate.textContent = `Auto: ${formatNumber(baseAutoPerSecond())}/s`;
    } else {
      const rate = tierProductionPerSecond(tier);
      el.rate.textContent = `-> ${state.tiers[idx - 1].name}: ${formatNumber(rate)}/s`;
      if (el.buyBtn) {
        // 🔒 Non-frontier tiers: fully lock manual acquire
        if (!isFrontierTier(tier)) {
          el.buyBtn.textContent = "Acquire Locked";
          el.buyBtn.dataset.tip = "Manual acquisition is disabled once the next tier is unlocked.";
          el.buyBtn.disabled = true;
          toggleDisabled(el.buyBtn, true);
          el.buyBtn.style.order = 999; // keep it out of the way
        } else {
          // ✅ Frontier tier: normal behavior
          const payer = state.tiers[idx - 1];
          const costFor = (count) =>
            seriesCostFromExp(tier.baseCost, tier.costGrowth, tier.amount, count, getDifficultyScalar());
          const buyCount = getAffordableBuyCount(getBuyMode(), payer.amount, costFor);
          const displayCount = buyCount > 0 ? buyCount : 1;
          const cost = costFor(displayCount);
          const label = buyLabel(getBuyMode(), buyCount);

          el.buyBtn.textContent = `Acquire${label} (${formatNumber(cost)} ${payer.name})`;
          el.buyBtn.dataset.tip =
            `Spend ${payer.name} to gain ${tier.name}.\nCost rises with amount and difficulty.`;

          const affordable = buyCount > 0;
          el.buyBtn.disabled = !affordable;
          toggleDisabled(el.buyBtn, !affordable);
          el.buyBtn.style.order = 0;
        }
      }
    }
    const payer = state.tiers[Math.max(0, tier.index - 1)];
    const autoBase = tier.autoCostBase;
    const effBase = tier.effCostBase;
    const autoLevel = tier.autoLevel;
    const effLevel = tier.efficiencyLevel;
    const mode = getBuyMode();
    const autoCostFor = (count) => seriesCostFromLevel(autoBase, 1.95, autoLevel, count, getDifficultyScalar());
    const effCostFor = (count) => seriesCostFromLevel(effBase, 2.05, effLevel, count, getDifficultyScalar());
    const autoCount = getAffordableBuyCount(mode, payer.amount, autoCostFor);
    const effCount = getAffordableBuyCount(mode, payer.amount, effCostFor);
    const autoDisplay = autoCount > 0 ? autoCount : 1;
    const effDisplay = effCount > 0 ? effCount : 1;
    const autoCost = autoCostFor(autoDisplay);
    const effCost = effCostFor(effDisplay);
    const autoLabel = buyLabel(mode, autoCount);
    const effLabel = buyLabel(mode, effCount);
    const affordAuto = autoCount > 0;
    const affordEff = effCount > 0;
    el.autoBtn.textContent = `Auto Lv${tier.autoLevel}${autoLabel} (${formatNumber(autoCost)})`;
    el.autoBtn.dataset.tip = `Adds automation for ${tier.name}. Uses ${payer.name}.`;
    el.autoBtn.disabled = !affordAuto;
    toggleDisabled(el.autoBtn, !affordAuto);
    el.autoBtn.style.order = 1;
    const effMult = tierEfficiencyMultiplier(tier).toFixed(2);
    el.effBtn.textContent = `Eff x${effMult}${effLabel} (${formatNumber(effCost)})`;
    el.effBtn.dataset.tip = `Boosts efficiency by +18% per level and buffer bonus.\nUses ${payer.name}.`;
    el.effBtn.disabled = !affordEff;
    toggleDisabled(el.effBtn, !affordEff);
    el.effBtn.style.order = 2;
  });

  const nextIndex = state.tiers.length;
  const unlockCost = tierUnlockCost(nextIndex);
  const prevTier = state.tiers[nextIndex - 1];
  if (nextIndex > 100) {
    ui.nextTierLabel.textContent = "Tier cap reached";
    ui.unlockTierButton.disabled = true;
    toggleDisabled(ui.unlockTierButton, true);
  } else {
    ui.nextTierLabel.textContent = `Tier ${nextIndex}: ${tierDisplayName(nextIndex)} Cost: ${formatNumber(unlockCost)} ${prevTier.name}`;
    const canUnlock = bnCmp(prevTier.amount, unlockCost) >= 0;
    ui.unlockTierButton.disabled = !canUnlock;
    toggleDisabled(ui.unlockTierButton, !canUnlock);
  }

  renderOpsLog();
  renderInfo();
  checkAchievements();
}

function renderInfo() {
  syncHardModeStatus();
  const elapsed = Date.now() - state.sessionStart;
  ui.sessionTime.textContent = formatDuration(elapsed);
  ui.upgradeCount.textContent = `${totalUpgradeLoad().toFixed(0)} load`;
  if (state.offlineSummary && state.offlineSummary.seconds > 0) {
    ui.offlineDisplay.textContent = `+${formatNumber(state.offlineSummary.gain)} in ${formatNumber(state.offlineSummary.seconds)}s`;
  } else {
    ui.offlineDisplay.textContent = "None";
  }
  const diff = state.manualDifficulty || 1;
  const costFactor = getManualCostFactor().toFixed(2);
  ui.difficultyStatus.textContent = `${diff} | cost x${costFactor}`;
  ui.hardModeStatus.textContent = state.hardModeStarted
    ? state.hardModeValid ? "Tracking" : "Invalidated"
    : "Idle";
  ui.integrityStatus.textContent = state.integrityFlag ? "Flagged" : "Clean";
  const cps = state.lastCps || 0;
  const grace = Date.now() < state.cpsGraceUntil;
  ui.cpsDisplay.textContent = `${cps.toFixed(1)}${state.penaltyScale < 1 && !grace ? " (penalty)" : ""}`;
  const titleSuffix = state.story?.title && state.story.title !== "Operator" ? ` | Title: ${state.story.title}` : "";
  const modeSuffix = state.story?.endlessUnlocked ? " | Mode: Endless" : "";
  ui.infoDetail.textContent = `Status: ${state.status || "Stable"}${titleSuffix}${modeSuffix}`;
}

function renderAchievements() {
  if (!ui.achievementsList) return;
  if (ui.achievementsSummary) {
    const total = achievementDefs.length;
    const unlocked = state.achievements.length;
    const stage = getCurrentStage();
    const topTier = state.tiers.length - 1;
    const sessionElapsed = formatDuration(Date.now() - state.sessionStart);
    const summaryItems = [
      { label: "Unlocked", value: `${unlocked}/${total}` },
      { label: "Prestiges", value: `${state.stats?.prestiges || 0}` },
      { label: "Highest Tier", value: `T${topTier}` },
      { label: "Stage", value: `${stage.id} ${stage.name}` },
      { label: "Clicks", value: `${formatNumber(state.stats?.clicks || 0)}` },
      { label: "Session", value: sessionElapsed },
      { label: "Total Credits", value: `${formatNumber(state.totalCurrency)}` },
      { label: "Load", value: `${totalUpgradeLoad().toFixed(0)}` }
    ];
    ui.achievementsSummary.innerHTML = "";
    const fragSummary = document.createDocumentFragment();
    summaryItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      const label = document.createElement("div");
      label.className = "summary-label";
      label.textContent = item.label;
      const value = document.createElement("div");
      value.className = "summary-value";
      value.textContent = item.value;
      card.append(label, value);
      fragSummary.appendChild(card);
    });
    ui.achievementsSummary.appendChild(fragSummary);
  }
  const frag = document.createDocumentFragment();
  achievementSections.forEach((section) => {
    const sectionDefs = achievementDefs.filter((a) => a.section === section);
    const unlockedCount = sectionDefs.filter((a) => state.achievements.includes(a.id)).length;
    const wrap = document.createElement("div");
    wrap.className = "achievement-section";
    const header = document.createElement("div");
    header.className = "achievement-section-header";
    header.textContent = `${section} (${unlockedCount}/${sectionDefs.length})`;
    wrap.appendChild(header);
    sectionDefs.forEach((def) => {
      const unlocked = state.achievements.includes(def.id);
      const row = document.createElement("div");
      row.className = `achievement${unlocked ? "" : " locked"}`;
      const left = document.createElement("div");
      left.innerHTML = `<div>${def.name}</div><div class="muted small-text">${def.desc}</div>`;
      const right = document.createElement("div");
      right.className = "muted mono";
      right.textContent = unlocked ? "Unlocked" : "Locked";
      row.append(left, right);
      wrap.appendChild(row);
    });
    frag.appendChild(wrap);
  });
  ui.achievementsList.innerHTML = "";
  ui.achievementsList.appendChild(frag);
}

function checkAchievements() {
  const newly = [];
  achievementDefs.forEach((def) => {
    if (state.achievements.includes(def.id)) return;
    if (def.check(state)) {
      state.achievements.push(def.id);
      newly.push(def);
    }
  });
  if (newly.length) {
    newly.forEach((def) => {
      showToast(`Achievement unlocked: ${def.name}`);
      logChatEvent(chatSources.system, `Achievement unlocked: ${def.name}`, { category: "achievement" });
      maybeNpcAchievement(def.name);
    });
    renderAchievements();
    saveGame();
  }
}

function toggleAchievementsModal() {
  ui.achievementsModal.classList.toggle("hidden");
  if (!ui.achievementsModal.classList.contains("hidden")) {
    renderAchievements();
  }
}

function showToast(text) {
  if (!ui.toastContainer) return;
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = text;
  ui.toastContainer.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function syncHardModeStatus() {
  if (bnCmp(state.totalCurrency, bnFromNumber(1000)) >= 0 && !state.hardModeStarted) {
    state.hardModeStarted = true;
    state.hardModeValid = state.manualDifficulty === 100;
  }
  if (state.hardModeStarted && state.hardModeValid && state.manualDifficulty !== 100) {
    state.hardModeValid = false;
  }
}

function onDifficultyChange() {
  recordPlayerAction();
  const raw = Number(ui.difficultyInput.value || 1);
  const clamped = Math.min(100, Math.max(1, Math.round(raw)));
  const was100 = state.manualDifficulty === 100;
  state.manualDifficulty = clamped;
  ui.difficultyInput.value = clamped;
  if (bnCmp(state.totalCurrency, bnFromNumber(1000)) >= 0) {
    if (clamped !== 100) state.hardModeValid = false;
    if (!state.hardModeStarted && clamped === 100) state.hardModeStarted = true;
  }
  if (was100 && clamped !== 100 && bnCmp(state.totalCurrency, bnFromNumber(1000)) >= 0) {
    state.hardModeValid = false;
  }
  setStatus(`Manual difficulty set to ${clamped}`);
  logChatEvent(chatSources.system, `difficulty set to ${clamped} (cost x${getManualCostFactor().toFixed(2)})`);
  saveGame();
  render(true);
}

function toggleDisabled(el, stateDisabled) {
  if (stateDisabled) el.classList.add("disabled");
  else el.classList.remove("disabled");
}

function formatNumber(value) {
  const v = bn(value);
  if (!isFinite(v.m)) return "INF";
  if (v.m === 0) return "0";
  const sign = v.m < 0 ? "-" : "";
  const abs = bnAbs(v);
  const exp = abs.e;

  if (exp < 3 && exp > -3) {
    const num = bnToNumber(abs);
    if (!isFinite(num)) return `${sign}INF`;
    if (exp >= 2) return `${sign}${num.toFixed(0)}`;
    if (exp >= 0) return `${sign}${num.toFixed(2)}`;
    return `${sign}${num.toFixed(4)}`;
  }

  if (exp <= -3) {
    const num = bnToNumber(abs);
    if (isFinite(num)) {
      const decimals = Math.min(8, Math.max(2, -exp + 2));
      return `${sign}${num.toFixed(decimals)}`;
    }
    return `${sign}${abs.m.toFixed(2)}e${exp}`;
  }

  const tier = Math.floor(exp / 3);
  const suffix = BIG_SUFFIXES[tier];
  const scaled = bnShift(abs, -tier * 3);
  const scaledNum = bnToNumber(scaled);
  const core = isFinite(scaledNum) ? scaledNum.toFixed(2) : scaled.m.toFixed(2);

  if (suffix) return `${sign}${core}${suffix}`;
  return `${sign}${core}e${exp}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (h > 0) parts.push(h.toString().padStart(2, "0"));
  parts.push(m.toString().padStart(2, "0"));
  parts.push(s.toString().padStart(2, "0"));
  return parts.join(":");
}

function buildAsciiBar(fill, phase = 0, staticFast = false) {
  const total = 22;
  const filled = Math.max(0, Math.min(total, Math.round(fill * total)));
  const chars = [];
  for (let i = 0; i < total; i++) {
    chars.push(i < filled ? "#" : ".");
  }
  if (staticFast) {
    const tail = Math.max(0, Math.min(total - 2, filled));
    chars[Math.min(total - 1, tail)] = ">";
    chars[Math.max(0, tail - 1)] = ">";
  } else if (phase > 0) {
    const pos = Math.floor(phase * total) % total;
    chars[pos] = ">";
  }
  return `[${chars.join("")}]`;
}

function chatSourceForTier(tier) {
  const index = typeof tier === "number" ? tier : tier.index;
  const name = typeof tier === "number" ? tierDisplayName(index) : tier.name;
  return { id: `T-${String(index).padStart(3, "0")}`, user: name, category: "tier" };
}

function bootstrapChat() {
  renderChat(true);
  const flags = chatFlags();
  if (!flags.booted) {
    const msg = state.integrityFlag ? "integrity warning; save sanitized" : "session link established";
    logChatEvent(chatSources.system, msg, { forceScroll: true });
    logChatEvent(chatSources.system, `operator ${resolvePlayerName()} linked`, { forceScroll: true });
    logChatEvent(chatSources.system, "objective: reach prestige 50", { forceScroll: true });
    flags.booted = true;
  }
  if (state.integrityFlag) {
    logChatEvent(chatSources.integrity, "integrity check failed on load; reset applied");
  }
  scheduleNpcChatter();
}

function recordPlayerAction(ts = Date.now()) {
  state.lastActionAt = ts;
}

function isPlayerAfk(now = Date.now()) {
  const last = state.lastActionAt || state.sessionStart || now;
  return now - last > AFK_THRESHOLD_MS;
}

function getOperatorRank(prestigeCount = 0) {
  const count = Math.max(0, Math.floor(Number(prestigeCount) || 0));
  for (let i = OPERATOR_RANKS.length - 1; i >= 0; i -= 1) {
    if (count >= OPERATOR_RANKS[i].min) return OPERATOR_RANKS[i].name;
  }
  return OPERATOR_RANKS[0].name;
}

function buildNpcContext(extra = {}) {
  const frontier = state.tiers[state.tiers.length - 1] || state.tiers[0];
  const prestigeCount = Math.max(0, state.stats?.prestiges || 0);
  const pending = bnFloor(state.prestige.pending);
  const required = Math.max(0, state.prestige.minRequired || 0);
  const stage = getCurrentStage();
  const title = getOperatorTitle();
  return {
    tier: String(frontier.index),
    tierIndex: frontier.index,
    tierName: frontier.name,
    stage: stage.name,
    stageIndex: stage.id,
    title,
    prestige: String(prestigeCount),
    prestigeCount,
    rank: getOperatorRank(prestigeCount),
    pending: formatNumber(pending),
    required: formatNumber(required),
    prestigeTotal: formatNumber(state.prestige.points),
    ...extra
  };
}

function normalizeNpcLine(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getGlobalNpcMemory() {
  const flags = chatFlags();
  if (!flags.npcGlobalMemory || typeof flags.npcGlobalMemory !== "object") {
    flags.npcGlobalMemory = { recent: {} };
  }
  if (!flags.npcGlobalMemory.recent || typeof flags.npcGlobalMemory.recent !== "object") {
    flags.npcGlobalMemory.recent = {};
  }
  return flags.npcGlobalMemory;
}

function isNpcLineRecentlyUsed(text, now, cooldownOverride) {
  const normalized = normalizeNpcLine(text);
  if (!normalized) return false;
  const memory = getGlobalNpcMemory();
  const windowMs = Math.max(NPC_GLOBAL_REPEAT_WINDOW_MS, cooldownOverride || 0);
  const last = memory.recent[normalized] || 0;
  return last && now - last < windowMs;
}

function recordNpcLineUsage(text, now = Date.now()) {
  const normalized = normalizeNpcLine(text);
  if (!normalized) return;
  const memory = getGlobalNpcMemory();
  memory.recent[normalized] = now;
  const cutoff = now - NPC_GLOBAL_REPEAT_WINDOW_MS;
  Object.keys(memory.recent).forEach((key) => {
    if (memory.recent[key] < cutoff) delete memory.recent[key];
  });
}

function coerceLineEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return { text: entry };
  if (typeof entry === "object") {
    return { ...entry, text: entry.text || "" };
  }
  return null;
}

function lineMatchesContext(entry, context = {}, opts = {}) {
  if (!entry || !entry.text) return false;
  const tierIndex = Number(context.tierIndex ?? context.tier ?? 0);
  const prestigeCount = Number(context.prestigeCount ?? context.prestige ?? 0);
  if (entry.tierMin != null && tierIndex < entry.tierMin) return false;
  if (entry.tierMax != null && tierIndex > entry.tierMax) return false;
  if (entry.prestigeMin != null && prestigeCount < entry.prestigeMin) return false;
  if (entry.prestigeMax != null && prestigeCount > entry.prestigeMax) return false;
  const tags = Array.isArray(entry.tags) ? entry.tags.map((t) => String(t).toLowerCase()) : [];
  if (tags.includes("afk") && !opts.allowAfk) return false;
  if (tags.includes("active") && opts.allowAfk) return false;
  return true;
}

function pickWeighted(entries) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + (Number(entry.weight) > 0 ? Number(entry.weight) : 1), 0);
  if (total <= 0) return entries[Math.floor(Math.random() * entries.length)];
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= Number(entry.weight) > 0 ? Number(entry.weight) : 1;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

function pickLine(pool, context = {}, opts = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const now = Date.now();
  const entries = pool
    .map(coerceLineEntry)
    .filter(Boolean)
    .filter((entry) => lineMatchesContext(entry, context, opts));
  if (!entries.length) return "";
  const filtered = entries.filter((entry) => !isNpcLineRecentlyUsed(entry.text, now, entry.cooldown));
  const choice = pickWeighted(filtered.length ? filtered : entries);
  return choice?.text || "";
}

function mergeNpcLines(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  Object.keys(extra).forEach((key) => {
    const extraVal = extra[key];
    if (Array.isArray(extraVal)) {
      if (!Array.isArray(base[key])) base[key] = [];
      base[key] = base[key].concat(extraVal);
    } else if (extraVal && typeof extraVal === "object") {
      if (!base[key] || typeof base[key] !== "object" || Array.isArray(base[key])) {
        base[key] = {};
      }
      mergeNpcLines(base[key], extraVal);
    } else if (base[key] == null) {
      base[key] = extraVal;
    }
  });
  return base;
}

function getNpcMemory(key) {
  const flags = chatFlags();
  if (!flags.npcMemory || typeof flags.npcMemory !== "object") {
    flags.npcMemory = {};
  }
  if (!flags.npcMemory[key]) {
    flags.npcMemory[key] = { lastTs: 0, lastText: "", recent: {} };
  }
  return flags.npcMemory[key];
}

function sendNpcChat(voice, text, opts = {}) {
  if (!text) return false;
  const now = Date.now();
  const key = (voice?.id || voice?.user || "npc").toString().toLowerCase();
  const memory = getNpcMemory(key);
  const normalized = normalizeNpcLine(text);
  if (!opts.force) {
    if (!opts.allowRapid && now - (memory.lastTs || 0) < NPC_LINE_COOLDOWN_MS) return false;
    if (memory.recent?.[normalized] && now - memory.recent[normalized] < NPC_REPEAT_WINDOW_MS) return false;
    if (isNpcLineRecentlyUsed(text, now, opts.repeatWindow)) return false;
  }
  memory.lastTs = now;
  memory.lastText = text;
  if (!memory.recent || typeof memory.recent !== "object") memory.recent = {};
  memory.recent[normalized] = now;
  Object.keys(memory.recent).forEach((entry) => {
    if (now - memory.recent[entry] > NPC_REPEAT_WINDOW_MS) delete memory.recent[entry];
  });
  recordNpcLineUsage(text, now);
  logChatEvent({ ...chatSources.npc, ...voice }, text, { tone: opts.tone });
  return true;
}

function logChatEvent(source, text, opts = {}) {
  if (!text) return;
  const color = opts.color || source?.color;
  let renderedText = text;
  if ((opts.category || source?.category) === "entity") {
    renderedText = corruptEntityText(text);
  }
  const entry = {
    ts: opts.ts || Date.now(),
    id: (opts.id || source?.id || "SYS-000").toString().toUpperCase(),
    user: opts.user || source?.user || "system",
    category: opts.category || source?.category || "system",
    text: renderedText,
    color,
    tone: opts.tone || null,
    type: opts.type === "divider" ? "divider" : "line"
  };
  if (entry.category === "entity") {
    triggerEntityImpact(false);
    maybeNpcEntityReaction();
    setStatus("Entity intrusion detected", { priority: 2, holdMs: 5000 });
  }
  state.chat.history.push(entry);
  if (state.chat.history.length > CHAT_HISTORY_LIMIT) {
    state.chat.history.splice(0, state.chat.history.length - CHAT_HISTORY_LIMIT);
  }
  state.chat.lastMessage = entry;
  if (entry.type === "divider") state.chat.lastDivider = entry.ts;
  renderChat(!state.chat.scrollLock || opts.forceScroll);
}

function logOpsEvent(text, category = "system") {
  if (!text) return;
  if (!Array.isArray(state.opsLog)) state.opsLog = [];
  state.opsLog.push({ ts: Date.now(), text: String(text), category });
  if (state.opsLog.length > OPS_LOG_LIMIT) {
    state.opsLog.splice(0, state.opsLog.length - OPS_LOG_LIMIT);
  }
  renderOpsLog();
}

function isOpsAtBottom() {
  if (!ui.opsLog) return true;
  const list = ui.opsLog;
  const diff = list.scrollHeight - list.scrollTop - list.clientHeight;
  return diff < OPS_SCROLL_TOLERANCE;
}

function renderOpsLog() {
  if (!ui.opsLog) return;
  const list = ui.opsLog;
  const atBottom = isOpsAtBottom();
  const prevScrollTop = list.scrollTop;
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  const entries = state.opsLog || [];
  if (!entries.length) {
    const line = document.createElement("div");
    line.className = "ops-line";
    const time = document.createElement("span");
    time.className = "ops-time";
    time.textContent = "--";
    const text = document.createElement("span");
    text.className = "ops-text";
    text.textContent = "Ops feed idle.";
    line.append(time, text);
    frag.appendChild(line);
    list.appendChild(frag);
    return;
  }
  entries.forEach((entry) => {
    const line = document.createElement("div");
    const category = entry.category || "system";
    line.className = `ops-line cat-${category}`;
    const time = document.createElement("span");
    time.className = "ops-time";
    time.textContent = formatChatTime(entry.ts);
    const text = document.createElement("span");
    text.className = "ops-text";
    text.textContent = entry.text;
    line.append(time, text);
    frag.appendChild(line);
  });
  list.appendChild(frag);
  if (atBottom) {
    list.scrollTop = list.scrollHeight;
  } else {
    list.scrollTop = Math.min(prevScrollTop, Math.max(0, list.scrollHeight - list.clientHeight));
  }
}

function renderChat(forceStick = false) {
  if (!ui.chatList) return;
  const list = ui.chatList;
  const atBottom = isChatAtBottom();
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  const mentionName = resolvePlayerName();
  const mentionPattern = mentionName
    ? new RegExp(`@${escapeRegex(mentionName)}(\\b|$)`, "i")
    : null;
  (state.chat.history || []).forEach((entry) => {
    if (entry.type === "divider") {
      const div = document.createElement("div");
      div.className = "chat-divider";
      div.textContent = entry.text || "++++++++++++++++++++++++++++";
      frag.appendChild(div);
      return;
    }
    const line = document.createElement("div");
    line.className = `chat-line cat-${entry.category || "system"}`;
    if (entry.tone) line.dataset.tone = entry.tone;
    const prefix = document.createElement("div");
    prefix.className = "chat-prefix";
    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = formatChatTime(entry.ts);
    const id = document.createElement("span");
    id.className = "chat-id";

    let displayId = entry.id || "----";

    if (entry.category === "entity") {
      const prestige = state.stats?.prestiges || 0;

      const finalId = state.story?.endlessUnlocked ? "WD-000" : "OP-000";

      if (prestige < 40) {
        displayId = finalId
          .split("")
          .map((c) =>
            c === "-"
              ? "-"
              : ENCHANT_GLYPHS[Math.floor(Math.random() * ENCHANT_GLYPHS.length)]
          )
          .join("");
      } else {
        const progress = Math.min(1, (prestige - 40) / 7);
        const revealCount = Math.floor(finalId.length * progress);

        displayId = finalId
          .split("")
          .map((c, i) =>
            c === "-"
              ? "-"
              : i < revealCount
                ? c
                : ENCHANT_GLYPHS[Math.floor(Math.random() * ENCHANT_GLYPHS.length)]
          )
          .join("");
      }
    }

    id.textContent = displayId;

    const user = document.createElement("span");
    user.className = "chat-user";

    let displayUser = entry.user || "system";

    if (entry.category === "entity") {
      const prestige = state.stats?.prestiges || 0;

      const finalName = getOperatorTitle().toUpperCase();

      if (prestige < 40) {
        displayUser = Array(finalName.length)
          .fill(0)
          .map(() => ENCHANT_GLYPHS[Math.floor(Math.random() * ENCHANT_GLYPHS.length)])
          .join("");
      } else {
        const progress = Math.min(1, (prestige - 40) / 7);
        const revealCount = Math.floor(finalName.length * progress);

        displayUser = finalName
          .split("")
          .map((c, i) =>
            i < revealCount
              ? c
              : ENCHANT_GLYPHS[Math.floor(Math.random() * ENCHANT_GLYPHS.length)]
          )
          .join("");
      }
    }

    user.textContent = displayUser;



    const resolvedColor = resolveEntryColor(entry);
    if (resolvedColor) {
      user.style.color = resolvedColor;
    }
    if ((entry.user || "").toLowerCase() === "erebusares") {
      user.classList.add("dev-glow");
    }
    if ((entry.user || "").toLowerCase() === "verify") {
      user.classList.add("verify-glow");
      if (resolvedColor) {
        user.style.textShadow = `0 0 8px ${resolvedColor}88, 0 0 14px ${resolvedColor}44`;
      }
    }
    if ((entry.user || "").toLowerCase() === "fears") {
      user.classList.add("fears-glow");
      if (resolvedColor) {
        user.style.textShadow = `0 0 8px ${resolvedColor}88, 0 0 14px ${resolvedColor}44`;
      }
    }
    const sep = document.createElement("span");
    sep.className = "chat-sep";
    sep.textContent = "::: ";
    prefix.append(time, id, user, sep);
    const text = document.createElement("span");
    text.className = "chat-text";
    text.textContent = entry.text || "";
    if (mentionPattern && mentionPattern.test(entry.text || "")) {
      line.classList.add("mention-hit");
    }
    line.append(prefix, text);
    frag.appendChild(line);
  });
  list.appendChild(frag);
  updateChatFooter(state.chat.lastMessage);
  const shouldStick = forceStick || !state.chat.scrollLock || atBottom;
  toggleLiveButton(shouldStick);
  if (shouldStick) {
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
      handleChatScroll();
    });
  }
}

function updateChatFooter(entry) {
  if (!ui.chatInput) return;
  if (!entry) {
    ui.chatInput.placeholder = "broadcast to feed...";
    return;
  }
  ui.chatInput.placeholder = `${formatChatTime(entry.ts)} ${entry.id} ${entry.user} ::: ${entry.text}`;
}

function isChatAtBottom() {
  if (!ui.chatList) return true;
  const list = ui.chatList;
  const diff = list.scrollHeight - list.scrollTop - list.clientHeight;
  return diff < CHAT_SCROLL_TOLERANCE;
}

function handleChatScroll() {
  if (!ui.chatList) return;
  const atBottom = isChatAtBottom();
  state.chat.scrollLock = !atBottom;
  toggleLiveButton(atBottom);
}

function scrollChatToLive() {
  if (!ui.chatList) return;
  ui.chatList.scrollTop = ui.chatList.scrollHeight;
  state.chat.scrollLock = false;
  handleChatScroll();
}

function toggleLiveButton(atBottom) {
  if (!ui.chatLiveButton) return;
  ui.chatLiveButton.classList.toggle("hidden-live", atBottom);
}

function formatChatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}${m}`;
}

function insertChatDivider(label = "") {
  const text = label ? `++++ ${label} ++++` : "++++++++++++++++++++";
  logChatEvent(chatSources.system, text, { type: "divider", category: "system" });
}

function logClickRun(now) {
  const lastTs = state.chat.lastClickTs || 0;
  if (lastTs && now - lastTs > CLICK_RUN_COOLDOWN && state.chat.runCount > 0) {
    flushClickRun();
  }
  state.chat.runCount = (state.chat.runCount || 0) + 1;
  state.chat.lastClickTs = now;
  scheduleClickRunFlush();
}

function scheduleClickRunFlush() {
  if (clickRunTimer) clearTimeout(clickRunTimer);
  clickRunTimer = setTimeout(() => {
    flushClickRun();
  }, CLICK_RUN_COOLDOWN);
}

function flushClickRun() {
  if (!state.chat.runCount) return;
  logChatEvent(chatSources.core, `${state.chat.runCount} clicks executed`);
  if (state.chat.runCount >= 50) maybeNpcClick();
  maybeNpcClickLong(state.chat.runCount);
  state.chat.runCount = 0;
  state.chat.lastRunFlush = Date.now();
}

function notePenaltyState() {
  const grace = Date.now() < state.cpsGraceUntil;
  const reduced = state.penaltyScale < 1 && !grace;
  const flags = chatFlags();
  if (reduced && !flags.penaltyActive) {
    const warningLine = pick(antiCheatSystemLines) || "sentinel: penalty detected; reducing funds.";
    logChatEvent(chatSources.warning, warningLine);
    const voice = pick(npcVoices);
    const context = buildNpcContext();
    const template =
      buildPersonaLine(voice, "antiCheat", context) ||
      pickLine(npcLibrary.antiCheat || [], context) ||
      "autoclick vibes? that's weak.";
    sendNpcChat(voice, formatNpcText(template, voice, context), { tone: "warning", allowRapid: true });
    maybeNpcWhisperEvent("warning", "penalty detected", 0.8);
    flags.penaltyActive = true;
  } else if (!reduced && flags.penaltyActive && state.penaltyScale > 0.995) {
    logChatEvent(chatSources.system, "manual input normalized");
    flags.penaltyActive = false;
  }
}

function maybeNpcFirstClick() {
  const flags = chatFlags();
  if (flags.firstClick) return;
  flags.firstClick = true;
  broadcastNpcGroup("welcome", 3);
  maybeNpcWhisperEvent("firstClick", "", 1);
}

function maybeNpcFirstUpgrade() {
  const flags = chatFlags();
  if (flags.firstUpgrade) return;
  flags.firstUpgrade = true;
  pushNpcLine("upgrade");
}

function maybeNpcTierUnlock(tier) {
  const flags = chatFlags();
  const key = `tier-${tier.index}`;
  if (!flags[key]) {
    flags[key] = true;
    pushNpcLine("tierContext", "", { tone: "tier" });
  }
  if ([10, 25, 50, 100].includes(tier.index)) {
    pushNpcLine("milestone");
  }
}

function maybeNpcPrestige(gained) {
  pushNpcLine("prestige");
  pushNpcLine("prestigeContext", "", { tone: "prestige" });
  if (bnCmp(gained, bnFromNumber(5)) > 0) pushNpcLine("milestone");
  maybeNpcWhisperEvent("prestige", `+${formatNumber(gained)}`);
  npcProgressCatchUp("prestige");
}

function clearNpcThreadTimers() {
  npcThreadTimers.forEach((t) => clearTimeout(t));
  npcThreadTimers = [];
}

function runNpcConversationThread(from, to, thread) {
  if (!thread || !Array.isArray(thread.lines) || thread.lines.length === 0) return;

  clearNpcThreadTimers();

  let delay = 0;
  for (const part of thread.lines) {
    delay += 650 + Math.random() * 850; // 650ms–1500ms between lines
    const speaker = part.who === "to" ? to : from;

    const timer = setTimeout(() => {
      const line = formatNpcText(part.text, speaker, { from: from.user, to: to.user });
      sendNpcChat(speaker, line, { allowRapid: true });
    }, delay);

    npcThreadTimers.push(timer);
  }
}

function maybeNpcAchievement(name) {
  broadcastNpcGroup("achievement", 4, { detail: name }, true);
  maybeNpcWhisperEvent("achievement", name, 0.75);
  npcProgressCatchUp("achievement");
}

function maybeNpcClick() {
  pushNpcLine("click");
}

function maybeNpcClickLong(runCount) {
  if (runCount < 200) return;
  const grace = Date.now() < state.cpsGraceUntil;
  if (state.penaltyScale < 0.99 && !grace) return;
  const flags = chatFlags();
  const now = Date.now();
  if (flags.lastClickLong && now - flags.lastClickLong < 70000) return;
  flags.lastClickLong = now;
  const detail = `${runCount} clicks`;
  pushNpcLine("clickLong", detail, { tone: "praise", allowRapid: true });
}

function npcProgressCatchUp(reason = "") {
  const flags = chatFlags();
  if (!flags.npcProgress) flags.npcProgress = {};
  const playerTier = Math.max(0, state.tiers.length - 1);
  const playerPrestige = state.stats?.prestiges || 0;
  const chance = 0.45;
  if (Math.random() > chance) return;
  const voice = pick(npcVoices);
  const record = flags.npcProgress[voice.user] || { tier: 0, prestige: 0 };
  const tierSkill = voice.highscore ? Math.max(1, voice.skill || 1.05) : Math.max(0.35, Math.min(0.9, voice.skill || 0.6));
  const prestigeSkill = voice.highscore ? Math.max(0.8, tierSkill) : Math.max(0.3, Math.min(0.9, tierSkill + 0.1));
  const targetTier = Math.max(record.tier, Math.min(playerTier + (voice.highscore ? 6 : 2), Math.floor(playerTier * tierSkill)));
  const targetPrestige = Math.max(record.prestige, Math.floor(playerPrestige * prestigeSkill));
  const updates = [];
  if (targetTier > record.tier) {
    record.tier = targetTier;
    updates.push(`Tier ${targetTier}`);
  }
  if (targetPrestige > record.prestige && targetPrestige > 0) {
    record.prestige = targetPrestige;
    updates.push(`Reboot ${targetPrestige}`);
  }
  flags.npcProgress[voice.user] = record;
  if (updates.length) {
    const template = pickLine(npcLibrary.npcProgress, buildNpcContext());
    const text = formatNpcText(template, voice, buildNpcContext({ progress: updates.join(", ") }));
    const tone = updates.some((entry) => entry.startsWith("Reboot")) ? "prestige" : "tier";
    sendNpcChat(voice, text, { tone });
  } else if (voice.highscore && Math.random() < 0.4) {
    // High scorer flexes occasionally
    sendNpcChat(
      voice,
      formatNpcText("{user} is aiming past {player}. don't blink.", voice, buildNpcContext()),
      { tone: "rank" }
    );
  }
}

function buildPersonaLine(voice, kind, context = {}) {
  const personaPick = pickPersonaLine(voice, kind, context);
  if (personaPick) return personaPick;
  const fallbackKey = kind === "firstClick" ? "welcome" : kind;
  const fallback = npcLibrary[fallbackKey];
  if (fallback && fallback.length) return pickLine(fallback, context);
  return pickLine(npcLibrary.whisper, context);
}

function maybeNpcWhisperEvent(kind, detail = "", chanceOverride = null) {
  const flags = chatFlags();
  const now = Date.now();
  const cooldown = 8000;
  if (flags.lastNpcWhisper && now - flags.lastNpcWhisper < cooldown) return;
  const chance = chanceOverride ?? (kind === "firstClick" ? 1 : 0.55);
  if (Math.random() > chance) return;
  const voice = pick(npcVoices);
  const template = buildPersonaLine(voice, kind, buildNpcContext({ detail }));
  if (!template) return;
  const text = formatNpcText(template, voice, buildNpcContext({ detail }));
  sendNpcWhisper(voice, text);
}

function broadcastNpcGroup(kind, count = 3, extra = {}, allowNames = false) {
  const shuffled = [...npcVoices].sort(() => 0.5 - Math.random()).slice(0, Math.max(1, count));
  const used = new Set();
  shuffled.forEach((voice) => {
    const basePool = npcLibrary[kind] || [];
    let template = buildPersonaLine(voice, kind, buildNpcContext(extra));
    if (!allowNames && template && /{user}/i.test(template)) {
      const filtered = basePool.filter((entry) => {
        const text = typeof entry === "string" ? entry : entry?.text || "";
        return !/{user}/i.test(text);
      });
      template = pickLine(filtered, buildNpcContext(extra)) || template;
    }
    const context = buildNpcContext(extra);
    let text = formatNpcText(template, voice, context);
    let attempts = 0;
    while (used.has(text) && attempts < 5) {
      const retry = buildPersonaLine(voice, kind, context) || pickLine(basePool, context);
      text = formatNpcText(retry, voice, context);
      attempts += 1;
    }
    used.add(text);
    if (extra?.detail && !text.includes(extra.detail)) {
      text = `${text} (${extra.detail})`;
    }
    sendNpcChat(voice, text, { tone: extra?.tone });
  });
}

function maybeEntityMessage() {
  // Entity only speaks after early progression
  if (!DEV_MODE && (!state.prestige || bnCmp(state.prestige.points, bnFromNumber(3)) < 0)) return;

  let pool;
  const prestigeCount = Math.max(0, state.stats?.prestiges || 0);
  if (state.story?.endlessUnlocked || prestigeCount >= 45) {
    pool = entityLines.final || entityLines.late;
  } else if (bnCmp(state.prestige.points, bnFromNumber(8)) < 0) {
    pool = entityLines.early;
  } else if (bnCmp(state.prestige.points, bnFromNumber(15)) < 0) {
    pool = entityLines.mid;
  } else {
    pool = entityLines.late;
  }

  if (!Array.isArray(pool) || pool.length === 0) return;

  // Filter out lines already spoken
  const unseen = pool.filter((line) => !state.seenEntityLines.includes(line));

  // If all lines have been spoken, Entity goes silent
  if (unseen.length === 0) return;

  const line = pick(unseen);

  // Remember the raw (uncorrupted) line
  state.seenEntityLines.push(line);

  logChatEvent(chatSources.entity, line);
}


function maybeDevTip() {
  const flags = chatFlags();
  const now = Date.now();
  if (now - (flags.lastDevTip || 0) < 45000) return;
  flags.lastDevTip = now;
  logChatEvent(chatSources.dev, pick(devTips));
}

function maybeNpcEntityReaction() {
  const flags = chatFlags();
  const now = Date.now();
  if (now - (flags.lastEntityNpcReaction || 0) < 45000) return;
  if (Math.random() > 0.55) return;
  const template = pickLine(npcLibrary.entityReact || [], buildNpcContext());
  if (!template) return;
  flags.lastEntityNpcReaction = now;
  const voice = pick(npcVoices);
  const line = formatNpcText(template, voice, buildNpcContext());
  sendNpcChat(voice, line, { tone: "warning", allowRapid: true });
}

function pushNpcLine(kind, detail = "", opts = {}) {
  const voice = opts.voice || pick(npcVoices);
  const context = buildNpcContext({ detail, ...(opts.extra || {}) });
  const template = buildPersonaLine(voice, kind, context) || pickLine(npcLibrary[kind] || [], context);
  if (!template) return;
  let text = formatNpcText(template, voice, context);
  if (detail && !text.includes(detail)) {
    text = `${text} (${detail})`;
  }
  sendNpcChat(voice, text, { tone: opts.tone, allowRapid: opts.allowRapid, force: opts.force });
}

function scheduleNpcChatter() {
  if (npcChatterTimer) clearTimeout(npcChatterTimer);
  const delay = 18000 + Math.random() * 18000;
  npcChatterTimer = setTimeout(() => {
    triggerNpcChatter();
    scheduleNpcChatter();
  }, delay);
}

function triggerNpcChatter() {
  const flags = chatFlags();
  if (!flags.firstClick) return; // stay quiet until player clicks once
  if (isPlayerAfk()) {
    const voice = pick(npcVoices);
    const template = pickLine(npcLibrary.idle || [], buildNpcContext(), { allowAfk: true });
    if (template) {
      const line = formatNpcText(template, voice, buildNpcContext());
      sendNpcChat(voice, line, { tone: "idle" });
    }
    return;
  }

  if (Math.random() < 0.22) {
    const voice = pick(npcVoices);
    const choices = [{ key: "tierContext", tone: "tier" }, { key: "rankContext", tone: "rank" }];
    if (bnCmp(state.prestige.pending, bnZero()) > 0 || (state.stats?.prestiges || 0) > 0) {
      choices.push({ key: "prestigeContext", tone: "prestige" });
    }
    const stage = getCurrentStage();
    if (stage.index >= 2) {
      choices.push({ key: "stageContext", tone: "stage" });
    }
    const choice = pick(choices);
    const template = pickLine(npcLibrary[choice.key] || [], buildNpcContext());
    if (template) {
      const line = formatNpcText(template, voice, buildNpcContext());
      if (sendNpcChat(voice, line, { tone: choice.tone })) return;
    }
  }

  const convoChance = Math.random();
  if (convoChance < 0.35) {
    const from = pick(npcVoices);
    let to = pick(npcVoices);
    if (to.id === from.id) {
      to = pick(npcVoices.filter((v) => v.id !== from.id)) || to;
    }
    // Prefer longer multi-line threads sometimes
    const threads = npcLibrary.conversationThreads || [];
    if (threads.length && Math.random() < 0.33) {
      const thread = pick(threads);
      runNpcConversationThread(from, to, thread);
    } else {
      const pair = pick(npcLibrary.conversationQA || []);
      if (pair && pair.ask && pair.answer) {
        const askLine = formatNpcText(pair.ask, from, buildNpcContext({ to: to.user, from: from.user }));
        const replyLine = formatNpcText(pair.answer, to, buildNpcContext({ from: from.user, to: to.user }));
        sendNpcChat(from, askLine, { allowRapid: true });
        sendNpcChat(to, replyLine, { allowRapid: true });
      } else {
        const template = pickLine(npcLibrary.conversation, buildNpcContext({ to: to.user }));
        if (template) {
          const line = formatNpcText(template, from, buildNpcContext({ to: to.user }));
          sendNpcChat(from, line, { allowRapid: true });
        }
      }
    }

    return;
  }
  const voice = pick(npcVoices);
  const text = pickPersonaLine(voice, "banter", buildNpcContext()) || pickLine(npcLibrary.random, buildNpcContext());
  if (text) {
    const line = formatNpcText(text, voice, buildNpcContext());
    sendNpcChat(voice, line);
  }
}

function formatNpcText(template, voice, extra = {}) {
  if (!template) return "";
  const player = resolvePlayerName();
  return template
    .replace(/{player}/gi, player)
    .replace(/{user}/gi, voice?.user || "")
    .replace(/{to}/gi, extra.to || "")
    .replace(/{from}/gi, extra.from || "")
    .replace(/{detail}/gi, extra.detail || "")
    .replace(/{progress}/gi, extra.progress || "")
    .replace(/{tier}/gi, extra.tier || "")
    .replace(/{tierName}/gi, extra.tierName || "")
    .replace(/{stage}/gi, extra.stage || "")
    .replace(/{stageIndex}/gi, extra.stageIndex || "")
    .replace(/{title}/gi, extra.title || "")
    .replace(/{rank}/gi, extra.rank || "")
    .replace(/{pending}/gi, extra.pending || "")
    .replace(/{required}/gi, extra.required || "")
    .replace(/{prestigeTotal}/gi, extra.prestigeTotal || "")
    .replace(/{prestige}/gi, extra.prestige || "");
}

function triggerNpcGreeting() {
  if (state.chat.flags.greeted) return;

  const greetings = [...npcLibrary.welcome]
    .sort(() => Math.random() - 0.5);
  if (!greetings || greetings.length === 0) return;

  // pick 4 unique NPCs
  const npcs = [...npcVoices]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  let delay = 0;

  npcs.forEach((npc, index) => {
    delay = 100 + index * 400 + Math.random() * 100;

    setTimeout(() => {
      const text = formatNpcText(
        greetings[index % greetings.length],
        npc,
        buildNpcContext()
      );

      sendNpcChat(npc, text, { force: true });
    }, delay);
  });

  // lock greeting so it never happens again
  state.chat.flags.greeted = true;
}


function pick(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveEntryColor(entry) {
  if (entry.color) return entry.color;
  if (entry.category === "npc" && entry.id) {
    const voice = npcVoices.find((v) => v.id.toUpperCase() === entry.id.toUpperCase());
    if (voice && voice.color) return voice.color;
  }
  if (entry.category === "whisper") return WHISPER_COLOR;
  if (entry.category === "operator") return chatSources.operator.color;
  if (entry.category === "dev" || (entry.user || "").toLowerCase() === "erebusares") {
    return "#ffd479";
  }
  return null;
}

function resolvePlayerName() {
  if (state.story?.endlessUnlocked) return getOperatorTitle();
  if (state.playerName) return state.playerName;
  const detected = detectPlayerName();
  state.playerName = detected;
  try {
    localStorage.setItem("terminalIdlePlayer", detected);
  } catch { }
  return detected;
}

function detectPlayerName() {
  const stored = (() => {
    try {
      return localStorage.getItem("terminalIdlePlayer");
    } catch {
      return null;
    }
  })();
  if (stored) return stored;
  const globalUser = window.USERNAME || window.userName || window.USER || window.NICKNAME || window.OPERATOR;
  const trimmed = (globalUser || "").toString().trim();
  if (trimmed) return trimmed.slice(0, 24);
  return getOperatorTitle();
}

function corruptEntityText(text) {
  const prestiges = state.stats?.prestiges || 0;
  const reveal = Math.max(0, Math.min(1, (prestiges - 3) / 47)); // full reveal by prestige ~50
  const chars = text.split("");
  let lastGlyph = null;

  const result = chars.map((ch) => {
    if (ch === " ") {
      lastGlyph = null;
      return " ";
    }

    const keepChance = reveal + 0.12;
    if (Math.random() < keepChance) {
      lastGlyph = null;
      return ch;
    }

    if (Math.random() < 0.1) {
      lastGlyph = null;
      return "[" + ch + "]";
    }

    let glyph;
    do {
      glyph = ENCHANT_GLYPHS[Math.floor(Math.random() * ENCHANT_GLYPHS.length)];
    } while (glyph === lastGlyph);

    lastGlyph = glyph;
    return glyph;
  });

  return result.join("");
}


function handleChatSend() {
  if (!ui.chatInput) return;
  const raw = ui.chatInput.value || "";
  const text = raw.trim();
  if (!text) return;
  ui.chatInput.value = "";
  recordPlayerAction();
  const player = resolvePlayerName();
  const whisper = parseWhisper(text);
  if (whisper) {
    sendWhisperFromOperator(player, whisper.target, whisper.message);
  } else {
    logChatEvent(chatSources.operator, text, { user: player, id: chatSources.operator.id, color: chatSources.operator.color, category: "operator" });
    handleMentions(text, player);
    reactToOperatorMessage(text);
  }
  trackOperatorSpam();
}

function parseWhisper(text) {
  const match = text.match(/^\/(w|whisper)\s+([^\s]+)\s+(.+)/i);
  if (!match) return null;
  return { target: match[2], message: match[3].trim() };
}

function resolveNpcVoice(targetRaw) {
  if (!targetRaw) return null;
  const target = targetRaw.toString().toLowerCase();
  return (
    npcVoices.find((v) => v.id.toLowerCase() === target) ||
    npcVoices.find((v) => v.user.toLowerCase() === target) ||
    npcVoices.find((v) => v.user.toLowerCase().startsWith(target))
  );
}

function logWhisperLine(from, to, text, color) {
  const opts = { user: `${from} -> ${to}`, id: "WHISPER", category: "whisper" };
  if (color) opts.color = color;
  logChatEvent(chatSources.whisper, text, opts);
}

function sendNpcWhisper(voice, text) {
  if (!text) return;
  const now = Date.now();
  const key = (voice?.id || voice?.user || "npc").toString().toLowerCase();
  const memory = getNpcMemory(key);
  const normalized = normalizeNpcLine(text);
  if (now - (memory.lastTs || 0) < NPC_LINE_COOLDOWN_MS) return;
  if (memory.recent?.[normalized] && now - memory.recent[normalized] < NPC_REPEAT_WINDOW_MS) return;
  if (isNpcLineRecentlyUsed(text, now)) return;
  memory.lastTs = now;
  memory.lastText = text;
  if (!memory.recent || typeof memory.recent !== "object") memory.recent = {};
  memory.recent[normalized] = now;
  Object.keys(memory.recent).forEach((entry) => {
    if (now - memory.recent[entry] > NPC_REPEAT_WINDOW_MS) delete memory.recent[entry];
  });
  recordNpcLineUsage(text, now);
  logWhisperLine(voice.user, resolvePlayerName(), text);
  chatFlags().lastNpcWhisper = Date.now();
}

function sendWhisperFromOperator(player, targetRaw, message) {
  const voice = resolveNpcVoice(targetRaw);
  if (!voice) {
    logChatEvent(chatSources.system, `unable to route whisper: ${targetRaw}`, { category: "system" });
    return;
  }
  if (!message) return;
  logWhisperLine(player, voice.user, message);
  const reply = pickWhisperTemplate(voice, message);
  if (reply) sendNpcWhisper(voice, formatNpcText(reply, voice, buildNpcContext()));
}

function pickPersonaLine(voice, kind, context = {}) {
  const pool = npcLibrary.personaPools?.[voice?.persona] || {};
  if (pool[kind]?.length) return pickLine(pool[kind], context);
  if (kind !== "whisper" && pool.banter?.length) return pickLine(pool.banter, context);
  if (pool.whisper?.length) return pickLine(pool.whisper, context);
  return null;
}

function detectWhisperTopic(message = "") {
  const lower = message.toLowerCase();
  if (/(help|hint|how|advice|guide)/.test(lower)) return "help";
  if (/(stuck|lost|blocked|wall)/.test(lower)) return "stuck";
  if (/(opt|efficien|route|build|calc|optimize)/.test(lower)) return "optimize";
  if (/(thanks|thank you|ty|appreciate)/.test(lower)) return "praise";
  if (/(hi|hello|hey|yo)/.test(lower)) return "greet";
  return "generic";
}

function pickWhisperTemplate(voice, message = "") {
  const topic = detectWhisperTopic(message);
  const persona = npcLibrary.personaPools?.[voice?.persona];
  const context = buildNpcContext();
  if (persona?.whisperTopics?.[topic]?.length) return pickLine(persona.whisperTopics[topic], context);
  if (persona?.whisperTopics?.generic?.length) return pickLine(persona.whisperTopics.generic, context);
  if (npcLibrary.whisperTopics?.[topic]?.length) return pickLine(npcLibrary.whisperTopics[topic], context);
  if (npcLibrary.whisperTopics?.generic?.length) return pickLine(npcLibrary.whisperTopics.generic, context);
  return pickPersonaLine(voice, "whisper", context) || pickLine(npcLibrary.whisper, context);
}

function maybeNpcWhisperReply(voice) {
  const flags = chatFlags();
  const now = Date.now();
  if (flags.lastNpcWhisper && now - flags.lastNpcWhisper < 3000) return;
  const template = pickWhisperTemplate(voice);
  if (!template) return;
  sendNpcWhisper(voice, formatNpcText(template, voice, buildNpcContext()));
}

function resolveTierFromArg(arg) {
  if (!arg) return null;

  const lower = arg.toLowerCase();

  // t0, t1, t2...
  if (/^t\d+$/.test(lower)) {
    const index = parseInt(lower.slice(1), 10);
    return state.tiers[index] || null;
  }

  // credits alias
  if (lower === "credits" || lower === "cr") {
    return state.tiers[0];
  }

  // name match (scripts, daemons, etc.)
  return state.tiers.find(t => t.name.toLowerCase() === lower) || null;
}

function reactToOperatorMessage(text) {
  const lower = text.toLowerCase();
  // DEV: manual entity trigger
  if (DEV_MODE && text.trim().toLowerCase() === "/entity") {
    maybeEntityMessage();
    return;
  }
  if (DEV_MODE && text.trim().toLowerCase() === "/entity reset") {
    state.seenEntityLines = [];
    logChatEvent(chatSources.system, "entity memory cleared");
    return;
  }

  // DEV: give resources
  if (DEV_MODE && lower.startsWith("/give")) {
    const parts = lower.split(/\s+/);
    const tierArg = parts[1];
    const amountArg = parts[2];

    const tier = resolveTierFromArg(tierArg);
    const amount = Math.floor(Number(amountArg));

    if (!tier || !Number.isFinite(amount) || amount <= 0) {
      setStatus("Usage: /give <tier|t#|credits> <amount>");
      return;
    }

    tier.amount = bnAdd(tier.amount, bnFromNumber(amount));

    setStatus(`DEV: Gave ${formatNumber(amount)} ${tier.name}`);
    logChatEvent(
      chatSources.dev,
      `Granted ${formatNumber(amount)} ${tier.name} via /give`
    );

    saveGame();
    render(true);
    return;
  }

  if (containsCurse(lower)) {
    const flags = chatFlags();
    const now = Date.now();
    const cooldownMs = 4000;

    // prevent spam
    if (!flags.lastCurseReaction || now - flags.lastCurseReaction > cooldownMs) {
      flags.lastCurseReaction = now;

      // 80% NPC reaction
      if (Math.random() < 0.8) {
        const voice = pick(npcVoices);
        const line =
          (npcLibrary.curse && npcLibrary.curse.length ? pickLine(npcLibrary.curse, buildNpcContext()) : null) ||
          "watch it, operator. the console remembers.";
        sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()));
      } else {
        // 20% Sentinel-ish reaction
        const line =
          (npcLibrary.curseSentinel && npcLibrary.curseSentinel.length ? pickLine(npcLibrary.curseSentinel, buildNpcContext()) : null) ||
          "verbal anomaly detected.";
        logChatEvent(chatSources.integrity, line);
      }
    }

    return;
  }

  if (lower === "help" || lower === "assist" || lower === "hint") {
    logChatEvent(chatSources.dev, pick(devTips));
    return;
  }
  if (isGibberish(lower)) {
    const voice = pick(npcVoices);
    sendNpcChat(voice, "???");
    return;
  }
  if (handleOperatorIntent(lower)) {
    return;
  }
  if (lower.includes("hello") || lower.includes("hi")) {
    const voice = pick(npcVoices);
    sendNpcChat(voice, formatNpcText("hey {player}. we're listening.", voice, buildNpcContext()));
    return;
  }
  maybeBroadcastToNpcGroup();
}

function containsCurse(text) {
  const curses = ["damn", "shit", "fuck", "bitch", "cunt", "asshole", "dick", "pussy", "nigger", "faggot", "cock", "bollocks"];
  return curses.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
}

function isGibberish(text) {
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length < 4) return false;
  const vowels = (letters.match(/[aeiou]/gi) || []).length;
  const ratio = vowels / letters.length;
  return ratio < 0.18 || /(.)\\1{3,}/.test(letters);
}

function handleOperatorIntent(lower) {
  const voice = pick(npcVoices);
  if (/(stuck|blocked|wall|halt)/.test(lower)) {
    const line = pickWhisperTemplate(voice, "stuck");
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()));
    return true;
  }
  if (/(optimize|efficien|route|build|calc)/.test(lower)) {
    const line = pickWhisperTemplate(voice, "optimize");
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()));
    return true;
  }
  if (/(thanks|thank you|ty|appreciate)/.test(lower)) {
    const line = pickWhisperTemplate(voice, "praise");
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()));
    return true;
  }
  if (/(rank|status|badge)/.test(lower)) {
    const line = pickLine(npcLibrary.rankContext, buildNpcContext()) || pickLine(npcLibrary.random, buildNpcContext());
    if (!line) return true;
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()), { tone: "rank" });
    return true;
  }
  if (/(tier|depth|layer|level)/.test(lower)) {
    const line = pickLine(npcLibrary.tierContext, buildNpcContext()) || pickLine(npcLibrary.milestone, buildNpcContext());
    if (!line) return true;
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()), { tone: "tier" });
    return true;
  }
  if (/(prestige|reset|reboot)/.test(lower)) {
    const line =
      pickLine(npcLibrary.prestigeContext, buildNpcContext()) ||
      buildPersonaLine(voice, "prestige", buildNpcContext()) ||
      pickLine(npcLibrary.prestige, buildNpcContext());
    sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()), { tone: "prestige" });
    return true;
  }
  return false;
}

function trackOperatorSpam() {
  const now = Date.now();
  operatorSpam.times = (operatorSpam.times || []).filter((t) => now - t < 8000);
  operatorSpam.times.push(now);
  const count = operatorSpam.times.length;
  if (count >= 5) {
    if (!operatorSpam.warned) {
      logChatEvent(chatSources.warning, "message flood detected; throttling");
      operatorSpam.warned = true;
    }
    return;
  }
  if (count >= 3) {
    const voice = pick(npcVoices);
    sendNpcChat(voice, "slow down, we're reading.");
  }
}

function maybeBroadcastToNpcGroup() {
  if (Math.random() > 0.4) return;
  const pool = [...npcVoices].sort(() => 0.5 - Math.random()).slice(0, 3);
  pool.forEach((voice) => {
    const line = formatNpcText("got your ping, {player}.", voice, buildNpcContext());
    sendNpcChat(voice, line);
  });
}

function handleMentions(text, playerName) {
  const mentions = Array.from(text.matchAll(/@([\w-]+)/gi)).map((m) => m[1]);
  if (!mentions.length) return;
  mentions.forEach((m) => {
    const voice = resolveNpcVoice(m);
    if (voice) {
      const line = buildPersonaLine(voice, "banter") || formatNpcText("yo {player}, heard you called?", voice, buildNpcContext());
      sendNpcChat(voice, formatNpcText(line, voice, buildNpcContext()));
    }
  });
}

function chatFlags() {
  if (!state.chat.flags) state.chat.flags = {};
  return state.chat.flags;
}

function setStatus(message, opts = {}) {
  const now = Date.now();
  const priority = Number(opts.priority ?? 1);
  const holdMs = Number(opts.holdMs ?? 0);
  if (statusState.until > now && statusState.priority > priority) {
    return;
  }
  const resolved = message || "Stable";
  state.status = resolved;
  statusState = {
    message: resolved,
    priority,
    until: holdMs > 0 ? now + holdMs : now
  };
  if (ui.status) {
    ui.status.querySelector("span:first-child").textContent = `STATUS: ${resolved}`;
  }
}




