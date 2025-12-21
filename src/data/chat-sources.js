export const WHISPER_COLOR = "#ff8aa8";

export const chatSources = {
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
    obfuscated: true
  },
  whisper: { id: "WHISPER", user: "WHISPER", category: "whisper", color: WHISPER_COLOR }
};
