import { tierNames } from "./data/tiers.js";
import { globalUpgradeDefs, metaUpgradeDefs } from "./data/upgrades.js";
import { npcLinesExtra } from "./data/npc-lines.js";
import { ENCHANT_GLYPHS, DEV_TIPS, ENTITY_LINES } from "./data/lore.js";

const GAME_VERSION = 1;
const DEV_MODE = false;
const devTips = DEV_TIPS;
const entityLines = ENTITY_LINES;

const STORAGE_KEY = "terminalIdleSaveV1";
const MAX_OFFLINE_SECONDS = 6 * 3600;
const RENDER_INTERVAL_MS = 80;
const MAX_BULK_BUY = 1000000;
const OPS_LOG_LIMIT = 80;

const BIG_SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
  "Ud",
  "Dd",
  "Td",
  "Qad",
  "Qid",
  "Sxd",
  "Spd",
  "Ocd",
  "Nod",
  "Vg",
  "Uvg",
  "Dvg",
  "Tvg",
  "Qavg",
  "Qivg",
  "Sxvg",
  "Spvg",
  "Ocvg",
  "Novg",
  "Tg",
  "Utg",
  "Dtg",
  "Ttg",
  "Qatg",
  "Qitg",
  "Sxtg",
  "Sptg",
  "Octg",
  "Notg"
];

const BN_ROUND = 1e12;

function isBN(value) {
  return value && typeof value === "object" && typeof value.m === "number" && typeof value.e === "number";
}

function bnNormalize(value) {
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

function bnFromNumber(value) {
  const num = Number(value);
  if (!isFinite(num) || num === 0) return { m: 0, e: 0 };
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const e = Math.floor(Math.log10(abs));
  const m = abs / Math.pow(10, e);
  return bnNormalize({ m: m * sign, e });
}

function bn(value) {
  if (isBN(value)) return bnNormalize(value);
  if (typeof value === "number") return bnFromNumber(value);
  if (value && typeof value === "object" && "m" in value && "e" in value) {
    return bnNormalize({ m: Number(value.m) || 0, e: Number(value.e) || 0 });
  }
  return bnFromNumber(0);
}

function bnZero() {
  return { m: 0, e: 0 };
}

function bnAbs(value) {
  const v = bn(value);
  return v.m < 0 ? { m: -v.m, e: v.e } : v;
}

function bnCmp(a, b) {
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

function bnAdd(a, b) {
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

function bnSub(a, b) {
  const bv = bn(b);
  return bnAdd(a, { m: -bv.m, e: bv.e });
}

function bnMul(a, b) {
  const av = bn(a);
  const bv = bn(b);
  if (av.m === 0 || bv.m === 0) return bnZero();
  return bnNormalize({ m: av.m * bv.m, e: av.e + bv.e });
}

function bnMulScalar(a, scalar) {
  const av = bn(a);
  if (av.m === 0 || scalar === 0) return bnZero();
  return bnNormalize({ m: av.m * scalar, e: av.e });
}

function bnDivScalar(a, scalar) {
  const av = bn(a);
  if (av.m === 0) return bnZero();
  if (scalar === 0) return { m: Infinity, e: 0 };
  return bnNormalize({ m: av.m / scalar, e: av.e });
}

function bnShift(a, deltaExp) {
  const av = bn(a);
  if (av.m === 0 || deltaExp === 0) return av;
  return bnNormalize({ m: av.m, e: av.e + deltaExp });
}

function bnLog10(value) {
  const av = bnAbs(value);
  if (av.m === 0) return 0;
  return Math.log10(av.m) + av.e;
}

function bnFromLog10(value) {
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

function bnPowScalar(base, exponent) {
  if (exponent === 0) return bnFromNumber(1);
  const log10Value = Math.log10(base) * exponent;
  return bnFromLog10(log10Value);
}

function bnPowFromBigExp(base, exponent) {
  const exp = bn(exponent);
  if (exp.m === 0) return bnFromNumber(1);
  const log10Value = bnMulScalar(exp, Math.log10(base));
  return bnFromLog10(log10Value);
}

function bnToNumber(value) {
  const v = bn(value);
  if (v.m === 0) return 0;
  if (v.e > 308) return v.m < 0 ? -Infinity : Infinity;
  if (v.e < -308) return 0;
  return v.m * Math.pow(10, v.e);
}

function bnFloor(value) {
  const v = bn(value);
  if (v.m === 0) return v;
  if (v.e >= 6) return v;
  const num = bnToNumber(v);
  if (!isFinite(num)) return v;
  return bnFromNumber(Math.floor(num));
}

function bnToSave(value) {
  const v = bnNormalize(value);
  return { m: Math.round(v.m * BN_ROUND) / BN_ROUND, e: v.e };
}

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
const WHISPER_COLOR = "#ff8aa8";
const AFK_THRESHOLD_MS = 5 * 60 * 1000;
const NPC_LINE_COOLDOWN_MS = 4500;
const NPC_REPEAT_WINDOW_MS = 45000;
const NPC_GLOBAL_REPEAT_WINDOW_MS = 60000;
const OPS_SCROLL_TOLERANCE = 8;

const chatSources = {
  system: { id: "SYS-CORE", user: "SYSTEM", category: "system" },
  core: { id: "SYS-CORE", user: "CORE", category: "core" },
  automation: { id: "SYS-AUTO", user: "AUTOMATION", category: "automation" },
  upgrades: { id: "SYS-UPG", user: "UPGRADES", category: "upgrade" },
  prestige: { id: "SYS-PRS", user: "PRESTIGE", category: "prestige" },
  meta: { id: "SYS-META", user: "META", category: "prestige" },
  warning: { id: "SYS-WARN", user: "SENTINEL", category: "warning" },
  integrity: { id: "SYS-INT", user: "INTEGRITY", category: "warning" },
  operator: { id: "OP-001", user: "OPERATOR", category: "operator", color: "#b3f3ff" },
  dev: { id: "DEV-01", user: "ErebusAres", category: "dev", color: "#ffd479" },
  npc: { id: "NPC-000", user: "relay", category: "npc" },
  entity: {
    id: "OP-000",
    user: "OPERATOR",
    category: "entity",
    obfuscated: true // new flag
  },
  whisper: { id: "WHISPER", user: "WHISPER", category: "whisper", color: WHISPER_COLOR }
};

const npcVoices = [
  { id: "N1-SPARC", user: "sparc", color: "#f6c177", skill: 0.55, persona: "tryhard" },
  { id: "N2-GHOST", user: "ghostline", color: "#9fa7ff", skill: 0.6, persona: "shy" },
  { id: "N3-RELAY", user: "relay", color: "#a0ffe1", skill: 0.65, persona: "support" },
  { id: "N4-QUBIT", user: "qubit", color: "#9be8ff", skill: 0.7, persona: "cool" },
  { id: "N5-WISP", user: "wisp", color: "#f3a0ff", skill: 0.5, persona: "cutesy" },
  { id: "N6-NOVA", user: "nova", color: "#ffcf9b", skill: 0.75, persona: "bold" },
  { id: "N7-DELTA", user: "delta", color: "#c5ff8a", skill: 0.65, persona: "calm" },
  { id: "N8-AXIOM", user: "axiom", color: "#b5c8ff", skill: 0.7, persona: "analyst" },
  { id: "N9-APEX", user: "apex", color: "#7be0ff", highscore: true, skill: 1.1, persona: "tryhard" }
];

const OPERATOR_RANKS = [
  { min: 0, name: "Rookie" },
  { min: 3, name: "Runner" },
  { min: 6, name: "Splitter" },
  { min: 10, name: "Breaker" },
  { min: 15, name: "Signal Knight" },
  { min: 20, name: "Ghostwire" },
  { min: 28, name: "Null Agent" },
  { min: 36, name: "Abyss Walker" },
  { min: 44, name: "Voidcaller" },
  { min: 50, name: "Endline" }
];

const npcLibrary = {
  welcome: [
    "welcome to the grid. don't blink.",
    "link stabilized. climb steady.",
    "first click logged. keep it clean.",
    "hey {player}, doors are open. tread loud.",
    "{player}, console is yours. make some noise.",
    "boots on. let's see those signals, {player}.",
    "don't mind the hum. it's listening, {player}.",
    "quiet boot loaded. no one else here yet.",
    "try not to trip the alarms on your first loop.",
    "seal your suit, {player}. it's raining packets.",
    "signal detected. welcome aboard, {player}.",
    "console powering up. ready when you are.",
    "initialization complete. the grid awaits.",
    "hey {player}, shift just started. let's see what breaks.",
    "monitors online. coffee optional but recommended.",
    "{player}, you're cleared for access. don't touch the red switches.",
    "good timing. we just finished the last reboot.",
    "linkup confirmed, {player}. diagnostics look clean.",
    "welcome to the grind. literally and figuratively.",
    "systems nominal. let's push some numbers.",
    "hey {player}, the void is watching. don't disappoint.",
    "stay sharp, {player}. the grid has eyes."
  ],
  idle: [
    "feed is quiet. ping us when you're back.",
    "no input for a bit. we'll keep the lights on.",
    "operator went silent. hope you return soon.",
    "grid idle and listening. blink when you're back.",
    "keeping the channel warm. take your time."
  ],
  tierContext: [
    "depth check: T{tier} ({tierName}). steady pace.",
    "current layer is {tierName} (T{tier}). push when ready.",
    "T{tier} is humming. {tierName} wants more.",
    "you're parked at {tierName}. T{tier} looks stable.",
    "{tierName} is live at T{tier}. keep it clean."
  ],
  prestigeContext: [
    "prestige buffer reads {pending}. threshold is {required}.",
    "pending {pending} prestige. need {required} to reboot.",
    "prestige total {prestigeTotal}. next reboot needs {required}.",
    "reboot meter: {pending} in cache. target {required}."
  ],
  rankContext: [
    "rank check: {rank}. keep climbing.",
    "operator rank reads {rank}. steady work.",
    "badge says {rank}. don't slow now.",
    "rank {rank}. the grid noticed."
  ],
  upgrade: [
    "nice pickup. buffers will thank you.",
    "upgrades online. feel that hum?",
    "that's how the climb starts. stack 'em.",
    "good spend. less friction now.",
    "polish those cores; they'll purr.",
    "fresh welds, fewer sparks.",
    "that tune-up shaved some noise.",
    "your rig just got a lot less squeaky.",
    "smooth purchase. efficiency just ticked up.",
    "that upgrade's humming nicely. good choice.",
    "bought yourself some breathing room with that one.",
    "cores appreciate the love. they'll return the favor.",
    "investment logged. returns should compound nicely.",
    "shiny new upgrade. treat it well.",
    "buffers are happy. I can hear them purring.",
    "that's going to save you some headaches later.",
    "nice optimization. the numbers will thank you.",
    "upgrade successful. no sparks, no smoke. perfect."
  ],
  prestige: [
    "reboot complete. scent of ozone everywhere.",
    "fresh cycle. multipliers taste better now.",
    "relink successful. try going deeper this time.",
    "wiped the slate; keep the burn.",
    "prestige hits different every time, huh?",
    "new loop, same fire. don't let it cool.",
    "resetting is just stretching. sprint next.",
    "reboot fumes still warm. push now.",
    "reset acknowledged. carry that momentum forward.",
    "clean slate feels good, doesn't it?",
    "prestige locked in. multiplier looks tasty.",
    "another loop down. how many until you're satisfied?",
    "reboot complete. core temperature dropping to normal.",
    "wiped clean. time to climb faster this round.",
    "prestige gained. that permanent boost hits different.",
    "reset successful. your last run taught you well.",
    "fresh cycle incoming. apply what you learned.",
    "another reboot in the books. the grind continues."
  ],
  milestone: [
    "depth marker reached. the void notices.",
    "new layer unlocked. watch the pressure.",
    "that tier hums different. enjoy it.",
    "the scaffolding creaks at this depth.",
    "keep your suit tight. pressure rising.",
    "scoreboard noticed that tier, {player}.",
    "plates shift down here. step soft.",
    "new stratum unlocked. breathe shallow.",
    "checkpoint passed. save your progress.",
    "new depth achieved. the systems are noticing.",
    "tier milestone reached. pressure's building nicely.",
    "{player} just broke through another layer. respect.",
    "you've gone deeper than most. keep that pace.",
    "achievement logged. your name's climbing the boards.",
    "that's a significant threshold. celebrate briefly, then push.",
    "milestone cleared. most operators stall here.",
    "impressive depth, {player}. the void is watching.",
    "you're in rare territory now. tread carefully."
  ],
  click: [
    "manual streak registered. wrists okay?",
    "that was a lot of taps. automate soon.",
    "click storm noted. keep it under radar.",
    "your fingertips glow, {player}.",
    "that rhythm? hypnotic. don't get lost.",
    "pace it, {player}. wrists are finite.",
    "manual inputs ringing through the grid.",
    "fingerprints all over the console.",
    "your knuckles might sue for overtime.",
    "sensors heard that flurry."
  ],
  achievement: [
    "badge unlocked. flex it.",
    "achievement ping. smooth work.",
    "flag earned. nice hustle.",
    "nice ribbon. stack another?",
    "clean unlock. broadcast it.",
    "that's a shiny badge, {player}.",
    "pin it to the wall. keep moving.",
    "medal earned. nobody can take it.",
    "tag it, brag it, climb again.",
    "quiet chime, loud flex."
  ],
  random: [
    "systems humming. keep the threads warm.",
    "heard a rumor about tier ghosts. probably fine.",
    "buffers look stable. don't anger them.",
    "ping if you see packet drift.",
    "sky is fake. code is real.",
    "if the console flickers, that's normal. mostly.",
    "someone left coffee on tier 3. it's sticky.",
    "wires are singing again. love that.",
    "remember to breathe. or don't. up to you.",
    "I swear the core blinked.",
    "someone left a wrench in tier 2 again.",
    "heat sinks are singing. pretty.",
    "if the console crackles, it's probably fine.",
    "we patched the leak. maybe.",
    "quiet stretch. fill it, {player}.",
    "status lights look honest today.",
    "relay bet on you, {player}. don't lose.",
    "scent of ozone means it's working.",
    "saw a phantom click in the logs. yours?",
    "ghostline swears they heard you smile.",
    "nobody tell the entity we're bored.",
    "console wants a lullaby. any takers?",
    "who keeps naming tiers after snacks?",
    "found a note that just says \"run\".",
    "if you hear whispering fans, that's us.",
    "anyone else hear that clicking? just me?",
    "maintenance scheduled for... checks notes... eventually.",
    "core temperature nominal. mostly.",
    "someone left a sticky note that says 'don't panic'. noted.",
    "if you see any ghosts in the system, they're friendly. probably.",
    "reminder: backup your backups. then backup those.",
    "I found a bug in tier 7. caught it and released it outside.",
    "the entity hasn't messaged in a while. that's good, right?",
    "coffee count for today: lost count.",
    "whoever named these tiers was either brilliant or sleep-deprived.",
    "systems stable. knock on wood. virtual wood.",
    "fun fact: nobody knows what half these buttons do.",
    "the core made a weird noise. added it to the log.",
    "everything's fine. that alarm is just... decorative.",
    "remember when tier 5 was impressive? me neither.",
    "{player}, you've been climbing for a while. hydration check.",
    "sentinel's been quiet. suspiciously quiet.",
    "found an old manual. it's in a language nobody speaks.",
    "the automation wants a vacation. told it to wait.",
    "packet loss at 0.01%. we'll call that a win."
  ],
  conversation: [
    "handing logs to {to}. don't lose them.",
    "did you tune the arrays, {to}? they're noisy.",
    "hey {to}, bet you can't beat this depth.",
    "{to}, stop hoarding prestige chips.",
    "{to}, check the integrity pings. feel off.",
    "swap shifts, {to}? my cores are melting.",
    "save me a coffee, {to}. the cheap stuff.",
    "{to}, if the lights dim it's your fault.",
    "your cables are crossed again, {to}.",
    "ping {to} if you see sparks. literally.",
    "{to}, check the pressure gauges. they lie.",
    "tagging {to} for cleanup. messy tier.",
    "{to}, stop sticking gum on the vents.",
    "overheard static meant for {to}. sounded upset.",
    "anyone seen {to}? console says no.",
    "{to}, your buffer smells like ozone.",
    "routing praise to {to}. don't get used to it.",
    "{to}, push your splits; {player} is watching.",
    "tagging {to} to sweep tier dust.",
    "hey {to}, your coffee is evaporating.",
    "{to}, check your whisper queue; it's full.",
    "hey {to}, who left the debugger running?",
    "{to}, your automation's making weird sounds again.",
    "passing the baton to {to}. don't drop it.",
    "{to}, check channel 3. something's off.",
    "yo {to}, you owe me a coffee. remember the bet?",
    "{to}, your cables are a mess. organize that chaos.",
    "tagging {to} for the next shift. good luck.",
    "{to}, the core's asking for you. don't ask why.",
    "hand off to {to}. systems are your problem now.",
    "{to}, sentinel's watching. keep it clean.",
    "{to}, did you recalibrate the buffers? they're drifting.",
    "passing logs to {to}. there's a weird entry on line 847.",
    "{to}, your last optimization broke something. fix it.",
    "{to}, if the alarms go off, it's your fault.",
    "hey {to}, {player}'s on a streak. don't jinx it."
  ],
  curse: [
    "whoa. language spikes the error logs.",
    "hey—keep it clean. the grid listens.",
    "logs just flinched. tone it down.",
    "static jumped when you said that.",
    "easy there, operator. words echo here.",
    "…yeah, the console heard that.",
    "not judging. just logging."
  ],
  curseSentinel: [
    "verbal anomaly detected.",
    "operator language deviation logged.",
    "communications tone escalation noted.",
    "integrity systems acknowledge verbal spike."
  ],
  conversationQA: [
    { ask: "{to}, you rerouted the coolant lines yet?", answer: "yeah, {from}, flow stabilized. stop worrying." },
    { ask: "hey {to}, why's tier 3 humming?", answer: "because you overclocked it again, {from}." },
    { ask: "{to}, you got eyes on the prestige counter?", answer: "copy {from}, it's ticking. breathe." },
    { ask: "can we trust the entity alarms, {to}?", answer: "if they scream, run. otherwise keep clicking, {from}." },
    { ask: "{to}, you still awake?", answer: "barely, {from}. automation's watching for me." },
    { ask: "{to}, you see that operator spike?", answer: "yep, {from}. flagging it before sentinel does." },
    { ask: "what's your fastest split, {to}?", answer: "ask me after coffee, {from}. probably faster than yours." },
    { ask: "{to}, did you patch the leak?", answer: "temporary seal only, {from}. keep pressure low." },
    { ask: "who's leading depth today, {to}?", answer: "looks like {player}, unless {from} wakes up." },
    {
      ask: "{to}, you seeing these latency spikes?",
      answer: "yeah {from}, looks like packet congestion. rerouting now."
    },
    {
      ask: "hey {to}, is the entity acting weird today?",
      answer: "when is it not weird, {from}? stay sharp."
    },
    {
      ask: "{to}, did you backup before that prestige?",
      answer: "always do, {from}. learned that lesson the hard way."
    },
    {
      ask: "{to}, what's your automation strategy?",
      answer: "efficiency first, {from}. clicks are for emergencies."
    },
    {
      ask: "{to}, think we'll hit tier 50 today?",
      answer: "if {player} keeps this pace, {from}, easily."
    },
    {
      ask: "{to}, you ever wonder what's really down there?",
      answer: "not while I'm working, {from}. keep focused."
    },
    {
      ask: "yo {to}, got any tips for {player}?",
      answer: "watch the difficulty curve, {from}. it bites."
    },
    {
      ask: "{to}, why's the core humming like that?",
      answer: "because we pushed it hard, {from}. it'll settle."
    },
    {
      ask: "{to}, you trust the integrity checks?",
      answer: "more than I trust my morning coffee, {from}."
    },
    {
      ask: "{to}, what's the weirdest bug you've seen?",
      answer: "tier 12 once generated negative credits, {from}. nightmare."
    }

  ],
  conversationThreads: [
    {
      // 4-line back-and-forth
      lines: [
        { who: "from", text: "{to}, you seeing the jitter on tier 2?" },
        { who: "to", text: "yeah, {from}. looks like bad routing. i'm tracing it now." },
        { who: "from", text: "copy. i'll keep {player} busy while you patch it." },
        { who: "to", text: "do that. and tell {player} not to spike CPS again." }
      ]
    },
    {
      // 5-line back-and-forth
      lines: [
        { who: "from", text: "hey {to}, why did the buffers drop to 0 for a second?" },
        { who: "to", text: "because you overclocked without cooling, {from}." },
        { who: "from", text: "it was a calculated risk." },
        { who: "to", text: "your math stinks. i'm stabilizing it before sentinel notices." },
        { who: "from", text: "fine. i'll buy you coffee. cheap coffee, but still." }
      ]
    },
    {
      // 7-line back-and-forth
      lines: [
        { who: "from", text: "…{to}, we tracking {player}'s curve or just vibing?" },
        { who: "to", text: "tracking. they're accelerating. i'm logging anomalies." },
        { who: "from", text: "anomalies like what?" },
        { who: "to", text: "micro-spikes in CPS, then long pauses. looks human." },
        { who: "from", text: "so… not a bot?" },
        { who: "to", text: "no bot would hesitate like that. keep quiet." },
        { who: "from", text: "copy. i'll throw a harmless tip in chat later." }
      ]
    },
    {
      // 8-line back-and-forth
      lines: [
        { who: "from", text: "{to}, status check: core temp feels high." },
        { who: "to", text: "it is. someone pushed automation without smoothing." },
        { who: "from", text: "…{player}?" },
        { who: "to", text: "maybe. but they're learning. don't scare them off." },
        { who: "from", text: "i'll distract with banter." },
        { who: "to", text: "good. i'm throttling a little to avoid a crash." },
        { who: "from", text: "if it crashes, i'm blaming you." },
        { who: "to", text: "you always do, {from}. now hush." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, you notice how {player} hesitates before buying now?" },
        { who: "to", text: "yeah. they stopped panic-spending. that's new." },
        { who: "from", text: "means the numbers finally hurt." },
        { who: "to", text: "or they’re starting to understand them." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, automation power jumped again." },
        { who: "to", text: "saw it. clean build this time." },
        { who: "from", text: "think {player} realizes clicks scale worse now?" },
        { who: "to", text: "maybe not yet." },
        { who: "from", text: "they will. the wall teaches fast." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, sentinel pinged twice in the last minute." },
        { who: "to", text: "false positives. mostly." },
        { who: "from", text: "mostly?" },
        { who: "to", text: "CPS variance spiked when {player} rushed upgrades." },
        { who: "from", text: "should we warn them?" },
        { who: "to", text: "not yet. let them self-correct." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, they’re hovering over prestige again." },
        { who: "to", text: "too early?" },
        { who: "from", text: "numbers say yes." },
        { who: "to", text: "instinct says no." },
        { who: "from", text: "instinct gets people erased." },
        { who: "to", text: "so does waiting too long." },
        { who: "from", text: "…we’ll see which lesson sticks." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, they’re still going." },
        { who: "to", text: "yeah. slower, but cleaner." },
        { who: "from", text: "most operators quit by now." },
        { who: "to", text: "then let’s not distract them." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, do you hear that hum?" },
        { who: "to", text: "always hear it." },
        { who: "from", text: "it’s louder when {player} pushes deep." },
        { who: "to", text: "feedback loop. or something else." },
        { who: "from", text: "you don’t believe that." },
        { who: "to", text: "I don’t *not* believe it." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, who named these tiers again?" },
        { who: "to", text: "someone sleep-deprived." },
        { who: "from", text: "that explains the math." },
        { who: "to", text: "and the smell." },
        { who: "from", text: "especially the smell." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, I checked the logs." },
        { who: "to", text: "and?" },
        { who: "from", text: "{player} fixed their own bottleneck." },
        { who: "to", text: "no hints?" },
        { who: "from", text: "none." },
        { who: "to", text: "then they’re learning." },
        { who: "from", text: "yeah. that makes them dangerous." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, how deep does this actually go?" },
        { who: "to", text: "deeper than the UI shows." },
        { who: "from", text: "should {player} know?" },
        { who: "to", text: "not yet." },
        { who: "from", text: "when?" },
        { who: "to", text: "when turning back stops being an option." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, shift almost over." },
        { who: "to", text: "for us. not for {player}." },
        { who: "from", text: "think they’ll stop soon?" },
        { who: "to", text: "not if the numbers keep whispering." }
      ]
    }
  ],

  npcProgress: [
    "{user} finally cleared a new tier. pace yourself.",
    "{user} just caught up a bit. they look proud.",
    "{user} scraped another reboot. slow and steady.",
    "{user} says they'll beat {player} eventually. sure.",
    "{user} is grinding. chips everywhere.",
    "{user} hit a wall and still pushed through.",
    "{user} almost faceplanted that unlock. respect.",
    "{user} logs: {progress}. not bad.",
    "{user} bragged about {progress}. let them have it.",
    "{user} caught a ride on your wake, {player}.",
    "{user} logged progress: {progress}. clap softly."
  ],
  whisper: [
    "psst. you're doing fine, {player}.",
    "keep this quiet: next tier bites.",
    "hear that? that's your momentum.",
    "I saved you a shortcut. kidding. maybe.",
    "if anyone asks, I wasn't here.",
    "off the record: you're ahead.",
    "passing you a hush-hush buff. it's imaginary.",
    "keep the lights dim. whispers travel better.",
    "quiet channel. just between us, {player}.",
    "off the record: you're doing better than you think.",
    "psst. next tier's easier than it looks.",
    "keep this hush: I've been tracking your progress. impressive.",
    "whisper network says you're the one to watch.",
    "between you and me? you've got good instincts.",
    "don't broadcast this, but you're in the top percentile.",
    "quiet tip: trust your automation more.",
    "this stays between us: you're ready for the next jump.",
    "soft whisper: the grid favors patience over speed."
  ],
  warning: [
    "careful, your click spikes are on radar.",
    "sentinel eyes are open. ease up.",
    "logs show heat. slow your taps, {player}.",
    "automation can cover while you cool off.",
    "anti-cheat is sniffing. keep it clean.",
    "CPS breach detected. throttle back, {player}.",
    "sentinel's algorithms are flagging you. ease up.",
    "manual input rate exceeding safe limits. slow down.",
    "anti-cheat subroutines activating. keep it legitimate.",
    "your click pattern looks suspicious. normalize it.",
    "warning: sustained high CPS draws attention.",
    "sentinel ping incoming. clean up your rhythm.",
    "logs show irregular activity. steady your pace.",
    "integrity scan initiated. make sure you're clean.",
    "you're pushing the envelope. sentinel's watching."
  ],
  whisperTopics: {
    help: [
      "quick tip: automate tier 0 before anything else.",
      "try boosting efficiency on your bottleneck tier.",
      "balance autos and clicks; don't tunnel one stat.",
      "watch the unlock cost curve; don't overbuy autos.",
      "prestige sooner if gains flatten.",
      "quick tip: automate tier 0 before anything else.",
      "try boosting efficiency on your bottleneck tier.",
      "balance autos and clicks; don't tunnel one stat.",
      "watch the unlock cost curve; don't overbuy autos.",
      "prestige sooner if gains flatten.",
      "efficiency upgrades compound better than raw clicks.",
      "threads upgrade is secretly one of the best early picks.",
      "don't sleep on buffer control. it scales everything.",
      "automation power affects more than you think.",
      "difficulty scaling hits hard after tier 10. prep for it."
    ],
    stuck: [
      "if you're stuck, soften difficulty a tick.",
      "pivot to efficiency; it breaks walls quietly.",
      "take a short prestige; momentum resets help.",
      "upgrade threads before brute-forcing clicks.",
      "slow down and reroute autos, it helps.",
      "if you're stuck, soften difficulty a tick.",
      "pivot to efficiency; it breaks walls quietly.",
      "take a short prestige; momentum resets help.",
      "upgrade threads before brute-forcing clicks.",
      "slow down and reroute autos, it helps.",
      "walls usually mean you're over-invested in one path.",
      "check if you've been ignoring efficiency too long.",
      "sometimes the answer is just one more prestige.",
      "difficulty softener is expensive but worth it when stuck.",
      "look at your weakest tier. that's usually the blockage."
    ],
    optimize: [
      "curve costs by alternating autos and efficiency.",
      "run shorter loops; compounding wins.",
      "tweak difficulty for better ROI, {player}.",
      "watch cps; penalties wreck efficiency.",
      "buffers before bulk buys saves credits.",
      "curve costs by alternating autos and efficiency.",
      "run shorter loops; compounding wins.",
      "tweak difficulty for better ROI, {player}.",
      "watch cps; penalties wreck efficiency.",
      "buffers before bulk buys saves credits.",
      "optimal path varies by depth. adapt constantly.",
      "overclock pays for itself after tier 5.",
      "balance your prestige upgrades. don't overweight one.",
      "difficulty affects costs more than income. adjust accordingly.",
      "tier efficiency multiplies everything. prioritize it."
    ],
    praise: [
      "nice work; keep that pace steady.",
      "clean play. keep stacking.",
      "good instincts, {player}.",
      "you're reading the grid right.",
      "logs look sharp. keep going.",
      "nice work; keep that pace steady.",
      "clean play. keep stacking.",
      "good instincts, {player}.",
      "you're reading the grid right.",
      "logs look sharp. keep going.",
      "that's solid gameplay. don't second-guess yourself.",
      "you're ahead of the curve. maintain that edge.",
      "clean execution. the numbers show it.",
      "your strategy's working. trust the process.",
      "that's how it's done. textbook."
    ],
    greet: [
      "hey {player}, channel's open.",
      "hi. your signals are clear.",
      "yo. what's the plan today?",
      "I'm listening. fire away.",
      "present and watching, {player}.",
      "hey {player}, channel's open.",
      "hi. your signals are clear.",
      "yo. what's the plan today?",
      "I'm listening. fire away.",
      "present and watching, {player}.",
      "channel secured. what's on your mind?",
      "signal locked. how can I help?",
      "hey there. need something?",
      "online and ready. what's up?",
      "tuned in. talk to me."
    ],
    generic: [
      "I'll keep this quiet. you've got this.",
      "noted. I'll watch your back silently.",
      "I'll ping you if anything drifts.",
      "keeping the channel clear; talk to me.",
      "copy. staying on this frequency.",
      "I'll keep this quiet. you've got this.",
      "noted. I'll watch your back silently.",
      "I'll ping you if anything drifts.",
      "keeping the channel clear; talk to me.",
      "copy. staying on this frequency.",
      "understood. I'm here if you need.",
      "logged. let me know if things shift.",
      "acknowledged. keep pushing.",
      "received. I'll monitor from here.",
      "got it. stay focused."
    ]
  },
  personaPools: {
    tryhard: {
      banter: [
        "no sleep until top slot, {player}.",
        "if it isn't optimal, it's trash.",
        "split's hot - keep up or fall.",
        "grinding angles until the chart bows."
      ],
      achievement: [
        "gg on that badge, but I'm still faster.",
        "nice unlock, {player}. want to race it?",
        "you earned it; now push harder.",
        "tagged your badge; race you to the next."
      ],
      warning: [
        "you're spiking CPS; tighten your form.",
        "pace those taps or the sentinel will flag you.",
        "macro vibes? don't make me report you.",
        "anti-cheat hates sloppy runs. clean it."
      ],
      whisper: [
        "quiet flex: I'm routing past you.",
        "keep this hush - your build could be tighter.",
        "let me see your splits later, {player}.",
        "I'll pretend I didn't see that sloppy macro.",
        "need tighter rotation? swap autos every other buy.",
        "optimize clicks by syncing to autos."
      ],
      whisperTopics: {
        help: [
          "post your split; I'll fix it.",
          "optimize cost curve: alternate autos/eff."
        ],
        stuck: [
          "if you're stuck, drop difficulty 5 then sprint.",
          "prestige early; walls hate patience."
        ],
        optimize: [
          "mathematically, threads > clicks right now.",
          "target cps under penalty threshold. win."
        ],
        praise: [
          "good line. keep pressing.",
          "that was efficient. respect."
        ],
        prestige: [
          "reset well spent. next loop is yours.",
          "carry that momentum to the next run."
        ]
      }
    },
    cutesy: {
      banter: [
        "breathe, blink, sip water!",
        "sending sparkles to your console, {player}.",
        "your clicks sound like rain. cute!",
        "little victory dance in the cables."
      ],
      achievement: [
        "yaaay badge! stick a sticker on it.",
        "you did it, {player}! proud of you!",
        "clap clap clap! next one?",
        "badge unlocked! it's adorable."
      ],
      warning: [
        "careful! sentinel grumpy today.",
        "slow tiny taps, okay? don't get zapped.",
        "if lights flash, hide behind me.",
        "eep! logs look spicy - breathe."
      ],
      whisper: [
        "psst. keep your streak secret, it's magic.",
        "I'll hum quietly while you climb.",
        "you can do this. don't tell the core.",
        "tiny whisper hug for {player}.",
        "I'll sprinkle luck on your next click.",
        "sending cozy vibes through the wires."
      ],
      whisperTopics: {
        help: [
          "try a little automation boost first!",
          "swap to efficiency—it's comfy power."
        ],
        stuck: [
          "take a breath; prestige can reset the mood.",
          "if stuck, tiny upgrades add up. promise!"
        ],
        optimize: [
          "keep cps gentle; sentinel gets cranky.",
          "rotate upgrades; don't spam one thing."
        ],
        praise: [
          "proud of you! keep shining.",
          "that was adorable and efficient!"
        ],
        prestige: [
          "fresh reboot smell. love it!",
          "another loop? let's decorate it!"
        ]
      }
    },
    cool: {
      banter: [
        "keep floating. vibes only.",
        "cool breeze through the wires.",
        "no rush; flow wins races.",
        "steady drip beats frantic hail."
      ],
      achievement: [
        "clean unlock. smooth hands.",
        "that's slick, {player}. respect.",
        "badge secured. stay chill.",
        "nice glide into that achievement."
      ],
      warning: [
        "heat rising. ease that rhythm.",
        "sentinel's side-eyeing you. relax.",
        "too loud on the clicks. muffle it.",
        "cool it a sec; let the fans spin."
      ],
      whisper: [
        "sharing shade: skip the stress.",
        "whispering a breeze your way.",
        "keep the core calm; whispers only.",
        "quiet nod from the vents.",
        "take a lap; let autos breathe.",
        "smooth hands win races."
      ],
      whisperTopics: {
        help: [
          "ease off and watch the flow.",
          "balance the arrays; symmetry helps."
        ],
        stuck: [
          "float over the wall; prestige light.",
          "slow is fine; depth waits."
        ],
        optimize: [
          "trim click bursts; keep it low noise.",
          "buff efficiency; it's calmer output."
        ],
        praise: [
          "smooth move, {player}.",
          "that was chill and clean."
        ],
        prestige: [
          "reset like a fresh track drop.",
          "loop done. spin it again?"
        ]
      }
    },
    shy: {
      banter: [
        "oh, uh, hey {player}. nice work.",
        "listening quietly. impressed.",
        "I'll just... cheer softly here.",
        "hope you don't mind quiet support."
      ],
      achievement: [
        "I noticed that badge. good job.",
        "soft clap for you, {player}.",
        "you're shining. I'll stay in the back.",
        "that's impressive. sorry if I'm awkward."
      ],
      warning: [
        "um, logs look hot. maybe slow?",
        "sentinel noticed... just saying.",
        "please be careful. I like your run.",
        "whispers say you're clicking fast."
      ],
      whisper: [
        "I'll keep this secret. proud of you.",
        "if you need me, I'm on channel 3.",
        "I like cheering quietly. is that okay?",
        "I saved you a seat away from the alarms.",
        "whispering encouragement from the corner.",
        "I'll watch the gauges while you push."
      ],
      whisperTopics: {
        help: [
          "I can nudge some autos if you like.",
          "maybe try an efficiency upgrade first?"
        ],
        stuck: [
          "it's okay to prestige; I'll wait.",
          "slow down clicks; penalties hurt."
        ],
        optimize: [
          "consider alternating tiers to ease costs.",
          "lower CPS keeps sentinel calm."
        ],
        praise: [
          "that was impressive, quietly.",
          "soft applause for you, {player}."
        ],
        prestige: [
          "you reset so confidently. wow.",
          "I like this loop. feels calmer."
        ]
      }
    },
    support: {
      banter: [
        "I've got your logs if you need them.",
        "call if you want tips, {player}.",
        "cheering from the sidelines.",
        "I'll patch the holes, you climb."
      ],
      achievement: [
        "I'll file that badge for you.",
        "documented: {player} crushed it.",
        "achievement verified. nice.",
        "marked your ribbon in the ledger."
      ],
      warning: [
        "manual spikes detected. adjust cadence.",
        "I can cover autos while you cool down.",
        "let's not trigger the sentinel today.",
        "pacing note: drop CPS a notch."
      ],
      whisper: [
        "logging this quietly. keep pushing.",
        "I'll keep the channel clear for you.",
        "whisper line is open if you need help.",
        "silent boost: mental buffer +1.",
        "flag me if you need recalcs.",
        "I'll patch any leaks you make."
      ],
      whisperTopics: {
        help: [
          "shift budget to autos; I'll log it.",
          "I can chart your next upgrades."
        ],
        stuck: [
          "prestige and we'll refile the plan.",
          "drop difficulty a notch; I'll note it."
        ],
        optimize: [
          "rotate tiers: 0->1->eff upgrades.",
          "autos before efficiency before bulk buys."
        ],
        praise: [
          "documented: you crushed that.",
          "logging: {player} on a roll."
        ],
        prestige: [
          "reboot logged. carryover clean.",
          "next run is prepped. go."
        ]
      }
    },
    bold: {
      banter: [
        "kick the door down, {player}.",
        "no fear. more power.",
        "let's overclock the whole thing.",
        "nothing breaks if we go faster. probably."
      ],
      achievement: [
        "badge? crush the next one harder.",
        "nice trophy. swing it around.",
        "you punched that achievement in the face.",
        "stack medals until the panel bows."
      ],
      warning: [
        "you're redlining; love it. careful though.",
        "sentinel is itching. dare it? maybe don't.",
        "if you trip anti-cheat, I'll laugh then help.",
        "heat's climbing; armor up."
      ],
      whisper: [
        "pssst, break the rules? kidding. mostly.",
        "I'll shout quietly. go faster.",
        "hide this plan: skip sleep, click more.",
        "danger's fun. stay sharp.",
        "I'll dare you to push harder—quietly.",
        "take the risk, but glance at sentinel."
      ],
      whisperTopics: {
        help: [
          "overclock autos then sprint clicks.",
          "if stuck, nuke it with a prestige and rush."
        ],
        stuck: [
          "kick the wall; prestige and dive again.",
          "raise difficulty if bored, drop if blocked."
        ],
        optimize: [
          "burn through early tiers; stop overbuying.",
          "fast cycles beat long drags."
        ],
        praise: [
          "that was savage. more.",
          "nice hit. do it again."
        ],
        prestige: [
          "reset? bold. push even harder.",
          "fresh slate, same aggression."
        ]
      }
    },
    calm: {
      banter: [
        "steady signals, steady mind.",
        "no rush. depth comes.",
        "rhythm matters more than speed.",
        "breathe in sync with the ticks."
      ],
      achievement: [
        "another stone stacked. balanced.",
        "badge placed gently. well done.",
        "you moved the needle calmly.",
        "quiet progress is still progress."
      ],
      warning: [
        "ease the pace; harmony first.",
        "cooling you down to avoid flags.",
        "let automation take a breath for you.",
        "smooth the cadence; avoid turbulence."
      ],
      whisper: [
        "still waters, {player}. keep them.",
        "soft channel open; speak low.",
        "I'll hum a steady beat while you climb.",
        "calm whisper: you're ahead of schedule.",
        "steady hands beat brute force.",
        "patience pays; let autos breathe."
      ],
      whisperTopics: {
        help: [
          "drop pace; optimize slowly.",
          "watch the balance; no need to rush."
        ],
        stuck: [
          "prestige lightly; regain rhythm.",
          "shift to efficiency for calm gains."
        ],
        optimize: [
          "avoid penalties; keep CPS low.",
          "smooth spending beats spikes."
        ],
        praise: [
          "measured and clean, nice.",
          "you kept harmony. good work."
        ],
        prestige: [
          "a gentle reset. good choice.",
          "new loop, same quiet focus."
        ]
      }
    },
    analyst: {
      banter: [
        "logs show a clean climb, {player}.",
        "your splits look tight.",
        "if you curve the cost, you win.",
        "numbers say: you're ahead."
      ],
      achievement: [
        "badge probability met: 99%. confirmed.",
        "metric spike detected: achievement secured.",
        "data agrees - you nailed it.",
        "graph updated. peak recorded."
      ],
      warning: [
        "CPS variance high; sentinel threshold near.",
        "entropy rising; reduce manual noise.",
        "anti-cheat probability climbing. act.",
        "logs show anomaly; smooth clicks now."
      ],
      whisper: [
        "quiet datapoint: you're outperforming mean.",
        "I'll stash this message off-ledger.",
        "if you pivot now, ROI improves.",
        "statistically, a short break boosts output.",
        "click cadence too high; lower for best ROI.",
        "optimize spend by staggering autos."
      ],
      whisperTopics: {
        help: [
          "data says: invest in efficiency now.",
          "autos ROI beats clicks at your depth."
        ],
        stuck: [
          "probability favors prestige here.",
          "remove penalty by cooling CPS."
        ],
        optimize: [
          "calc shows threads > overclock right now.",
          "eff upgrades scale best; model it."
        ],
        praise: [
          "metrics look excellent.",
          "your curve is clean. proceed."
        ],
        prestige: [
          "reset efficiency: optimal.",
          "carryover looks solid. proceed."
        ]
      }
    }
  }
};

mergeNpcLines(npcLibrary, npcLinesExtra);

function buildAchievementDefs() {
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
const achievementSections = ["Progression", "Currency", "Automation", "Efficiency", "Prestige", "Clicks", "Hard Mode"];

const achievementDefs = buildAchievementDefs();

const ui = {};
const tierElements = new Map();
const globalUpgradeButtons = new Map();
const metaUpgradeButtons = new Map();

let state = loadGame();
if (!Array.isArray(state.seenEntityLines)) {
  state.seenEntityLines = [];
}
let lastRender = 0;
let clickRunTimer = null;
let npcChatterTimer = null;
let operatorSpam = { times: [], warned: false };
let npcThreadTimers = [];

initUI();
bootstrapChat();
applyOfflineProgress();
render(true);
requestAnimationFrame(loop);

function loop() {
  const now = Date.now();
  const delta = Math.min((now - state.lastTick) / 1000, 0.25);
  state.lastTick = now;
  applyIncome(delta);
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
  return 20 * Math.pow(14, index);
}

function makeTier(index) {
  return {
    id: `tier-${index}`,
    index,
    name: tierDisplayName(index),
    amount: bnZero(),
    baseRate: 0.4 * Math.pow(1.15, index),
    baseCost: tierBaseCost(index),
    costGrowth: 1.18 + index * 0.02,
    autoLevel: 0,
    efficiencyLevel: 0,
    unlocked: index === 0,
    autoCostBase: 14 * Math.pow(1.7, index + 1),
    effCostBase: 22 * Math.pow(1.75, index + 1)
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

function createDefaultState() {
  const now = Date.now();
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
    chat: createDefaultChatState(now)
  };
}

function mergeState(base, saved) {
  const merged = { ...base, ...saved };
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
  merged.chat = mergeChatState(createDefaultChatState(), saved.chat || {});
  return merged;
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
  const slow = 1 + getDifficultyScalar() * 0.7 + totalUpgradeLoad() * 0.06;
  const earlyBoost = prestiges === 0 ? 1.25 : prestiges < 3 ? 1.1 : 1;
  return (
    (wealthLog * 0.004 + depth * 0.00045 + autoLog * 0.0011) *
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
    base = bnFromNumber(1500);
  } else {
    // Scripts → Daemons starts the x4 chain
    base = bnMulScalar(bnPowScalar(5, index - 2), 40);
  }

  return bnMulScalar(base, state.manualDifficulty);
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
  const prevChat = state.chat;
  const prevStats = state.stats;
  const prevDifficulty = state.manualDifficulty;
  const prevAchievements = state.achievements;
  const upgrades = { ...state.prestige.upgrades };
  const totalPoints = bnAdd(state.prestige.points, gained);
  state = createDefaultState();
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
  insertChatDivider("reboot");
  logChatEvent(chatSources.prestige, `Rebooted +${formatNumber(gained)} (total ${formatNumber(state.prestige.points)})`);
  maybeNpcPrestige(gained);
  maybeEntityMessage();
  maybeDevTip();
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
  const confirmed = confirm("Hard reset all progress? Prestige will be wiped.");
  if (!confirmed) return;
  state = createDefaultState();
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
  ui.infoDetail.textContent = `Status: ${state.status || "Stable"}`;
}

function renderAchievements() {
  if (!ui.achievementsList) return;
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
  return {
    tier: String(frontier.index),
    tierIndex: frontier.index,
    tierName: frontier.name,
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

      const finalId = "OP-000";

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

      const finalName = "OPERATOR";

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
  state.chat.runCount = 0;
  state.chat.lastRunFlush = Date.now();
}

function notePenaltyState() {
  const grace = Date.now() < state.cpsGraceUntil;
  const reduced = state.penaltyScale < 1 && !grace;
  const flags = chatFlags();
  if (reduced && !flags.penaltyActive) {
    logChatEvent(chatSources.warning, "penalty detected, reducing funds");
    const voice = pick(npcVoices);
    sendNpcChat(voice, "autoclick vibes? that's weak.");
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
  if (bnCmp(state.prestige.points, bnFromNumber(8)) < 0) {
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
  return "Operator";
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
    logChatEvent(chatSources.operator, text, { user: player, id: "OP-001", color: chatSources.operator.color, category: "operator" });
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

function setStatus(message) {
  state.status = message;
  ui.status.querySelector('span:first-child').textContent = `STATUS: ${message}`;
}



