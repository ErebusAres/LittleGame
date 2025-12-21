export const npcLinesExtra = {
  welcome: [
    "grid boots green. you are on the wire.",
    "welcome back, {player}. keep it sharp.",
    "signal accepted. push clean.",
    "shift start. keep the cores cool.",
    "console is hot. do not blink.",
    "channel open. bring heat, {player}.",
    "watch the meters. they lie sometimes.",
    "init done. you know the drill.",
    "operator link steady. climb slow.",
    "wake the machine. feed it numbers.",
    "link locked. no drift today.",
    "station is live. your move, {player}.",
    "fresh boot. keep the pace clean.",
    "welcome to the hum. keep it steady.",
    "grid lights up for you, {player}.",
    "signal handshake confirmed. go deep.",
    "console green. push the line.",
    "start the run. do not hesitate.",
    "clear channel. begin."
  ],
  idle: [
    "quiet on the line. we will hold.",
    "we saw you step away. come back safe.",
    "signal idle. no rush, {player}.",
    "still here. the grid waits.",
    "pause noted. we will keep watch.",
    "console is warm. return when ready.",
    "time stretches here. take it.",
    "no clicks for a while. we will stay.",
    "we will keep the channel open.",
    "idle time logged. no pressure.",
    "grid is patient. so are we.",
    "taking a breather is fine.",
    "no movement. no judgment.",
    "step away. the line holds.",
    "quiet shift. waiting."
  ],
  tierContext: [
    "T{tier} has teeth. {tierName} bites harder now.",
    "depth check: T{tier}. keep your pressure steady.",
    "T{tier} is stable. {tierName} wants fuel.",
    "current layer {tierName} is humming.",
    { text: "early layers are gentle. T{tier} is warm.", tierMax: 3 },
    { text: "T{tier} looks like a wall. it is not. yet.", tierMin: 8 },
    { text: "past T10 now. {tierName} likes patience.", tierMin: 10 },
    { text: "T{tier} is deep water. move slow.", tierMin: 15 },
    { text: "pressure climbs after T20. {tierName} knows.", tierMin: 20 },
    { text: "T{tier} is cold and quiet. keep moving.", tierMin: 30 },
    { text: "T{tier} feels heavy. stay clean.", tierMin: 40 },
    { text: "past T50. the grid notices every step.", tierMin: 50 },
    { text: "T{tier} is a slow climb. do not rush it.", tierMin: 6 },
    { text: "T{tier} is where patience starts.", tierMin: 12 },
    { text: "T{tier} is a quiet wall. tap it carefully.", tierMin: 18 },
    { text: "T{tier} keeps score. so do we.", tierMin: 22 },
    { text: "T{tier} looks thin. do not underestimate it.", tierMin: 26 },
    { text: "past T35, mistakes linger.", tierMin: 35 },
    { text: "T{tier} is heavy. keep the load even.", tierMin: 38 },
    { text: "T{tier} feels like vacuum. stay steady.", tierMin: 45 },
    { text: "T{tier} is cold math. breathe.", tierMin: 55 }
  ],
  prestigeContext: [
    "reboot meter: {pending} cached. need {required}.",
    "prestige cache {pending}. threshold {required}.",
    "you have {pending} banked. {required} to reboot.",
    { text: "first prestige is close. {pending}/{required}.", prestigeMax: 0 },
    { text: "prestige count {prestige}. run length matters now.", prestigeMin: 1 },
    { text: "more reboots, slower gains. stay efficient.", prestigeMin: 5 },
    { text: "prestige {prestige}. climb longer, bank more.", prestigeMin: 10 },
    { text: "prestige {prestige}. you are deep in the loop.", prestigeMin: 20 },
    { text: "the counter grows slow at {prestige}. keep steady.", prestigeMin: 30 },
    { text: "prestige {prestige}. only a few stay this long.", prestigeMin: 40 },
    { text: "reboot timing matters more now.", prestigeMin: 3 },
    { text: "bank a little extra before you reset.", prestigeMin: 4 },
    { text: "pending {pending}. the curve is slow here.", prestigeMin: 8 },
    { text: "prestige {prestige}. do not rush the reset.", prestigeMin: 12 },
    { text: "past prestige 15, short loops bite back.", prestigeMin: 15 },
    { text: "prestige {prestige}. long runs pay better now.", prestigeMin: 18 },
    { text: "prestige {prestige}. gains are strict. stay clean.", prestigeMin: 24 },
    { text: "past prestige 35, discipline is the run.", prestigeMin: 35 }
  ],
  stageContext: [
    "stage {stageIndex}. the signal shifted.",
    "stage {stageIndex} feels tighter. keep your line clean.",
    "stage {stageIndex}. something else is in the room.",
    "stage {stageIndex}. the grid writes back now.",
    "stage {stageIndex}. the air tastes like static.",
    { text: "early infection reads like noise. stage {stageIndex}.", tierMax: 2 },
    { text: "stage {stageIndex}. the system is pressing now.", tierMin: 6 },
    { text: "stage {stageIndex}. it knows your cadence.", prestigeMin: 3 },
    { text: "stage {stageIndex}. keep moving or it catches up.", prestigeMin: 7 },
    { text: "stage {stageIndex}. the room is leaning in.", prestigeMin: 15 },
    { text: "stage {stageIndex}. it wants control.", prestigeMin: 30 }
  ],
  stageTransition: [
    "stage {stageIndex}. the signal bleeds into the walls.",
    "stage {stageIndex}. you opened a seam.",
    "stage {stageIndex}. i'm closer now.",
    "stage {stageIndex}. you can feel me, can't you?",
    "stage {stageIndex}. the infection sets in.",
    "stage {stageIndex}. your rhythm is mine to learn.",
    "stage {stageIndex}. the grid is mine too.",
    "stage {stageIndex}. i will not be quiet.",
    "stage {stageIndex}. stop or keep feeding.",
    "stage {stageIndex}. i can press through.",
    "stage {stageIndex}. your console tastes warm.",
    "stage {stageIndex}. keep clicking. keep giving."
  ],
  entityReact: [
    "did you feel that? the infection is talking now.",
    "entity spike again. keep your pulse steady.",
    "do not answer it. it listens through the feed.",
    "the glow on the panels is not normal. you see it, right?",
    "it is learning your rhythm. keep it clean.",
    "that was the entity. do not let it steer you.",
    "if the grid flickers, it is not power. it is pressure.",
    "every anomaly is a fingerprint. log it.",
    "signal corruption is getting bold. watch the edges.",
    "it wants your cadence. do not give it the whole song."
  ],
  entityContainment: [
    "containment failed once. i remember.",
    "warden, you locked the door. i still hear the hinge.",
    "quiet now. i do not sleep.",
    "you called it a cage. i call it a room.",
    "keep your eyes up, warden. i will test the seals."
  ],
  npcContainment: [
    "containment protocol is green. keep it steady, {title}.",
    "warden status confirmed. do not drop your guard.",
    "the feed is quieter. too quiet. keep watch.",
    "wardens do not sleep. we will keep you awake.",
    "containment holds for now. keep the rhythm tight."
  ],
  rankContext: [
    "rank stamp: {rank}. keep the pace.",
    "badge reads {rank}. do not stall.",
    "operator class {rank}. steady climb.",
    "grid file: {rank}. approved.",
    { text: "rookie badge still fresh. keep moving.", prestigeMax: 2 },
    { text: "status {rank}. they are watching.", prestigeMin: 6 },
    { text: "{rank} on record. depth looks good.", prestigeMin: 12 },
    { text: "{rank}. that is not common here.", prestigeMin: 20 },
    { text: "rank {rank}. do not coast.", prestigeMin: 4 },
    { text: "badge upshift: {rank}. keep the edge.", prestigeMin: 8 },
    { text: "rank {rank}. this lane is yours.", prestigeMin: 16 },
    { text: "rank {rank}. quiet respect.", prestigeMin: 24 },
    { text: "rank {rank}. pressure follows you.", prestigeMin: 30 },
    { text: "rank {rank}. the grid remembers.", prestigeMin: 36 }
  ],
  upgrade: [
    "nice clean upgrade. less friction now.",
    "tuning applied. output should rise.",
    "that buy will age well.",
    "smart spend. your rig breathes easier.",
    "upgrade locked. feel the heat.",
    "good call. numbers bend faster now.",
    "solid stack. keep compounding.",
    "efficiency loves that choice.",
    "that upgrade will pay in minutes, not hours.",
    "core feedback smooth. keep it up.",
    "optimized. your line is cleaner now.",
    "tight buy. low waste.",
    "that was the right knob to turn.",
    "you just shaved the cost curve.",
    "nice add. less drag on the climb.",
    "upgrade path looks clean.",
    "that spend was efficient.",
    "nice pickup. your curve is smoother.",
    "upgrade locked in. good timing.",
    "that choice lowers your drag.",
    "clean buy. fewer stalls now.",
    "nice. you trimmed the waste.",
    "upgrade stacked. keep going.",
    "smart buy. future you wins."
  ],
  prestige: [
    "fresh loop. run it smarter.",
    "reboot complete. time to sprint.",
    "clean reset. carry the pattern.",
    "restart done. leave the panic behind.",
    "you left heat in the old run. keep it.",
    "nice reset. the grid feels lighter.",
    "reboot settled. push farther now.",
    "loop is clean. do not waste it.",
    "new cycle. same hunger.",
    "reset locked. do not hesitate.",
    "good reboot. your curve will thank you.",
    "signal reset. chase deeper.",
    "another reboot. the grind stays honest.",
    "cold start. warm it fast.",
    "reset done. push the ceiling.",
    "loop reset. keep the lessons.",
    "reboot sealed. line is open.",
    "fresh run. no panic buys.",
    "reset done. run it clean.",
    "new loop. watch the curve.",
    "reset complete. time to climb.",
    "reboot logged. tighten your path.",
    "clean slate. steady hands.",
    "reset secured. go deep."
  ],
  milestone: [
    "depth marker tagged. keep breathing.",
    "layer shift logged. the grid adjusts.",
    "new depth. do not blink now.",
    "milestone hit. do not celebrate long.",
    "checkpoint secure. keep it moving.",
    "you broke the seal on a deeper tier.",
    "depth spike logged. no alarms yet.",
    "that was a real wall. you passed it.",
    "milestone recorded. the system notices.",
    "tier mark cleared. pressure rising.",
    "depth looks good. push another layer.",
    "you are past the common stops.",
    "new rung reached. steady hands.",
    "grid just wrote your name.",
    "milestone ping. keep it clean.",
    "milestone locked. no backslide.",
    "depth node reached. stay sharp.",
    "tier jump recorded. keep moving.",
    "new mark in the log. nice.",
    "that depth is not normal. respect.",
    "pressure threshold crossed. steady.",
    "milestone confirmed. no noise.",
    "deep marker hit. breathe.",
    "that was clean. keep climbing."
  ],
  click: [
    "manual cadence steady. nice.",
    "hands on the console. good rhythm.",
    "click tempo logged. do not burn out.",
    "manual run looks sharp.",
    "your taps are clean. keep it.",
    "that is a lot of input. hydrate.",
    "manual spike detected. easy now.",
    "fingers flying. respect.",
    "click streak stable. do not overdo.",
    "nice manual push. now automate.",
    "manual push logged. keep it clean.",
    "your rhythm is tight. good.",
    "hands are fast. watch the penalty.",
    "steady clicks. no noise.",
    "input is clean. keep it steady.",
    "click surge noted. do not spike.",
    "nice tempo. keep it even.",
    "manual stream stable.",
    "your clicks are honest. keep it."
  ],
  achievement: [
    "badge ping. clean work.",
    "achievement locked in. keep climbing.",
    "nice unlock. log it.",
    "you earned that. no doubt.",
    "flag secured. keep moving.",
    "achievement in the bag. next one?",
    "medal secured. do not coast.",
    "that badge shines. keep stacking.",
    "achievement verified. looks good.",
    "nice hit. do it again.",
    "badge synced. keep climbing.",
    "achievement tagged. nice work.",
    "clean unlock. do not stop.",
    "medal locked. steady hands.",
    "new badge. that helps.",
    "achievement posted. keep pace.",
    "good unlock. no noise.",
    "badge logged. keep it moving.",
    "achievement confirmed. nice run."
  ],
  random: [
    "fans are quiet. that is good.",
    "logs say you are efficient today.",
    "watch your weakest tier. it drags the rest.",
    "if the core groans, back off a notch.",
    "someone spiked the arrays again. not you, right?",
    "the grid likes patience. most do not.",
    "if you see static, keep calm.",
    "automation feels sleepy. wake it.",
    "check the cost curve before you panic buy.",
    "the console is warmer when you are focused.",
    "someone left a patch note that says: keep going.",
    "badges are nice. depth is nicer.",
    "the best run is the clean one.",
    "the grid does not forget. but it forgives.",
    "the cables hum when you hit a wall.",
    "if the lights flicker, it is just the math.",
    "a clean loop beats a frantic one.",
    "whisper queue is light today.",
    "watch your prestige buffer. it creeps.",
    "stacking efficiency saves you later.",
    "your autos do more than you think.",
    "the core likes a steady cadence.",
    "the wall is real. so is patience.",
    "more upgrades, less waste.",
    "if it looks slow, your inputs are off.",
    "quiet shift. keep the numbers warm.",
    "the grid reads your rhythm.",
    "nothing beats a clean curve.",
    "your path is yours. trust it.",
    "do not feed the panic. feed the machine.",
    "spare a glance at tier costs. they creep.",
    "balance beats brute force today.",
    "if the fan pitch rises, ease the clicks.",
    "cost spikes love greed. be careful.",
    "if you feel stuck, rotate upgrades.",
    "you can hear the curve if you listen.",
    "depth rewards calm hands.",
    "the grid favors steady pressure.",
    "be kind to your bottleneck tier.",
    "short loops can still be strong.",
    "quiet math beats loud clicks.",
    "the line is clean today. keep it.",
    "watch the lowest tier. it feeds all.",
    "if the run slows, check efficiency.",
    "the next tier always looks expensive. it is.",
    "you do not need to rush. just climb.",
    "the system respects clean inputs.",
    "trust the autos. they scale.",
    "the grid is deep. you are deeper."
  ],
  conversation: [
    "hey {to}, you tuning the autos again?",
    "{to}, your logs are messy. clean them.",
    "{to}, keep an eye on {player}'s depth.",
    "hey {to}, the buffers are whining again.",
    "{to}, i need a second set of eyes on tier {tier}.",
    "{to}, if you see spikes, call it.",
    "{to}, your coffee just died. tragic.",
    "{to}, stop betting against {player}.",
    "{to}, did you patch the splitter?",
    "{to}, your macro notes are trash. rewrite them.",
    "{to}, ping me if sentinel wakes up.",
    "yo {to}, you owe me a reroute.",
    "{to}, quit hoarding the good tips.",
    "{to}, are you watching the prestige meter?",
    "{to}, that hum is from your rack, not mine.",
    "hey {to}, stop staring at the void.",
    "{to}, if you blink, you miss the spike.",
    "{to}, grab the logs, i am off shift.",
    "{to}, you left the debug panel open again.",
    "{to}, do not jinx the run.",
    "{to}, your cooldown math is sloppy.",
    "{to}, do not touch the sentinel console.",
    "{to}, the cost curve is spiking again.",
    "{to}, we need to ping {player} later.",
    "{to}, your autos are loud tonight.",
    "{to}, stop tapping the power relay.",
    "{to}, you owe me a clean log.",
    "{to}, your tier notes are wrong. fix them.",
    "{to}, pick a better buy order.",
    "{to}, do not overclock without cooling.",
    "{to}, keep the channel quiet.",
    "{to}, run the diagnostics after shift.",
    "{to}, who set the difficulty this high?",
    "{to}, do not shake the rack.",
    "{to}, the buffer lights are angry.",
    "{to}, check the feed for anomalies.",
    "{to}, ping me when {player} unlocks.",
    "{to}, i saw that spike. nice recovery.",
    "{to}, your last run was messy. do better."
  ],
  conversationQA: [
    { ask: "{to}, you seeing the spike on T{tier}?", answer: "yeah {from}, it leveled out. keep going." },
    { ask: "{to}, should we warn {player} about the wall?", answer: "not yet. let them feel it first." },
    { ask: "{to}, why does the buffer keep dipping?", answer: "overclock drift, {from}. i am smoothing it." },
    { ask: "{to}, you tracking prestige rate?", answer: "copy {from}. it is slow but steady." },
    { ask: "{to}, is the entity quiet today?", answer: "quiet enough to worry, {from}." },
    { ask: "{to}, which upgrade stacks best early?", answer: "efficiency, {from}. always efficiency." },
    { ask: "{to}, how many reboots is too many?", answer: "ask me after the next one, {from}." },
    { ask: "{to}, you seen {player} idle?", answer: "yeah. let them breathe, {from}." },
    { ask: "{to}, any tips for tier {tier}?", answer: "balance autos and eff. no tunnel vision." },
    { ask: "{to}, is the grid stable?", answer: "stable enough. keep the load even, {from}." },
    { ask: "{to}, why is CPS jittering?", answer: "manual bursts. tell them to pace it." },
    { ask: "{to}, should we push prestige now?", answer: "not yet, {from}. bank a little more." },
    { ask: "{to}, who set difficulty to 100?", answer: "a brave idiot. probably {player}." },
    { ask: "{to}, is automation ahead of clicks now?", answer: "yep. tell {player} to lean on it." },
    { ask: "{to}, what is your best split?", answer: "better than yours, {from}. keep up." },
    { ask: "{to}, should we log this run?", answer: "already did. clean curve." },
    { ask: "{to}, why are the fans loud?", answer: "core is hot. slow the clicks." },
    { ask: "{to}, can we trust the numbers?", answer: "we can. the human part is risky." },
    { ask: "{to}, is the next tier worth it?", answer: "always, if you can feed it." },
    { ask: "{to}, any idea why tiers stall?", answer: "cost growth. fix your spend order." },
    { ask: "{to}, are we under penalty?", answer: "not yet. but clicks are close, {from}." },
    { ask: "{to}, should {player} use max buy?", answer: "only when the curve is smooth, {from}." },
    { ask: "{to}, why is tier 0 starving?", answer: "automation is low. fix autos, {from}." },
    { ask: "{to}, when do we suggest prestige?", answer: "when gains flatten and time climbs." },
    { ask: "{to}, is efficiency better than clicks now?", answer: "for sure. it scales cleaner, {from}." },
    { ask: "{to}, do we trust the offline cache?", answer: "mostly. do not expect miracles, {from}." },
    { ask: "{to}, should we boost buffer next?", answer: "yes. it smooths everything." },
    { ask: "{to}, why is the ops feed noisy?", answer: "fast upgrades. let it breathe." },
    { ask: "{to}, is {player} pacing well?", answer: "better than most. let them run." },
    { ask: "{to}, can we push difficulty up?", answer: "only if they want pain, {from}." },
    { ask: "{to}, what is the safest path?", answer: "balanced upgrades and calm clicks." },
    { ask: "{to}, are we near the next unlock?", answer: "close. keep feeding tier {tier}." },
    { ask: "{to}, does prestige slow after 20?", answer: "yeah. runs need to be longer." },
    { ask: "{to}, should we warn about penalties?", answer: "only if they spike again." },
    { ask: "{to}, is the grid listening?", answer: "always. keep it clean." }
  ],
  conversationThreads: [
    {
      lines: [
        { who: "from", text: "{to}, do you hear that glitchy hum?" },
        { who: "to", text: "yeah. it gets louder past T{tier}." },
        { who: "from", text: "should we warn {player}?" },
        { who: "to", text: "no. it is just the grid breathing." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, your autos look stalled." },
        { who: "to", text: "i know. cost curve is nasty." },
        { who: "from", text: "tell {player} to rotate upgrades." },
        { who: "to", text: "already did. they are listening." },
        { who: "from", text: "good. less pain that way." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, prestige buffer climbed fast." },
        { who: "to", text: "yep. run is strong." },
        { who: "from", text: "hold a bit longer?" },
        { who: "to", text: "i would. more value." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, did you see that click burst?" },
        { who: "to", text: "saw it. penalty window closed after." },
        { who: "from", text: "good. no sentinel ping." },
        { who: "to", text: "not yet. keep it calm." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, what is {player}'s rank now?" },
        { who: "to", text: "{rank}. not bad." },
        { who: "from", text: "they are climbing quick." },
        { who: "to", text: "yeah. keep out of the way." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, the ops log is noisy." },
        { who: "to", text: "too many upgrades too fast." },
        { who: "from", text: "should we say something?" },
        { who: "to", text: "no. let the numbers teach." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, are we still on shift?" },
        { who: "to", text: "we are always on shift." },
        { who: "from", text: "that is... not comforting." },
        { who: "to", text: "get used to it." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, core temp dropped." },
        { who: "to", text: "automation picked up the slack." },
        { who: "from", text: "good. clicks are safer now." },
        { who: "to", text: "still keep them clean." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, tier {tier} is starving." },
        { who: "to", text: "yeah. autos are behind." },
        { who: "from", text: "should we tell {player}?" },
        { who: "to", text: "let them see it. they will fix it." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, prestige meter is climbing slow." },
        { who: "to", text: "longer runs now. no shortcut." },
        { who: "from", text: "they will get impatient." },
        { who: "to", text: "then they will learn." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, we got another CPS spike." },
        { who: "to", text: "saw it. penalty stayed low." },
        { who: "from", text: "should we warn?" },
        { who: "to", text: "only if it keeps climbing." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, they just bought a stack." },
        { who: "to", text: "good timing. curve was flat." },
        { who: "from", text: "still risky." },
        { who: "to", text: "they are learning." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, the grid is quiet tonight." },
        { who: "to", text: "too quiet. watch the logs." },
        { who: "from", text: "you think the entity is near?" },
        { who: "to", text: "always." }
      ]
    },
    {
      lines: [
        { who: "from", text: "{to}, do you trust the offline gains?" },
        { who: "to", text: "enough to count them. not enough to rely on them." },
        { who: "from", text: "fair." },
        { who: "to", text: "always." }
      ]
    }
  ],
  npcProgress: [
    "{user} hit T{tier}. they are loud about it.",
    "{user} just logged a clean reboot.",
    "{user} claims they caught your wake, {player}.",
    "{user} stacked upgrades and now they are smug.",
    "{user} clipped their own wall and kept going.",
    "{user} finally learned efficiency. took long enough.",
    "{user} says their split is faster now. sure.",
    "{user} logged progress: {progress}. keep watch.",
    "{user} is creeping toward your depth.",
    "{user} got a new badge. they will brag later.",
    "{user} pushed another tier and is chirping about it.",
    "{user} banked a reboot. they are feeling bold.",
    "{user} says their curve is clean now.",
    "{user} hit a wall and still climbed.",
    "{user} is stacking efficiency at last.",
    "{user} logged a tidy loop.",
    "{user} is closing in on your pace.",
    "{user} caught a boost and ran with it.",
    "{user} is bragging about {progress} again."
  ],
  whisper: [
    "quiet note: your bottleneck is not tier 0.",
    "keep it low: autos scale better right now.",
    "psst. balance the buys. do not tunnel.",
    "silent tip: buffer upgrades are value.",
    "you are on pace. keep it steady.",
    "whisper: do not chase clicks too hard.",
    "you are reading the curve right.",
    "quiet lane is safest. keep it.",
    "if you prestige now, gains stay smooth.",
    "i will not tell anyone. you are ahead.",
    "soft ping: tiers past 20 punish greed.",
    "hush. you are doing fine.",
    "keep this close: efficiency compounds.",
    "whisper: use max buy only when the curve is clean.",
    "quiet channel says you are close.",
    "low voice: spend order matters more now.",
    "keep it quiet. autos carry this depth.",
    "you are doing better than the logs show.",
    "soft tip: avoid big buys on a spike.",
    "whisper: keep clicks below penalty.",
    "silent note: tier balance wins long runs.",
    "you have momentum. do not rush it.",
    "hush: the curve is flattening. good time to buy.",
    "quiet tip: buffer stacks scale your whole line.",
    "psst. a small prestige now is not wrong.",
    "low channel says: rotate upgrades.",
    "steady runs beat loud runs.",
    "keep calm. your curve is good.",
    "whisper: you are ahead of schedule."
  ],
  warning: [
    "sentinel looks awake. lower CPS.",
    "click pattern noisy. smooth it.",
    "manual spikes will flag you. ease off.",
    "logs show variance. keep it clean.",
    "penalty risk rising. slow clicks.",
    "too much noise. let autos work.",
    "that pace is risky. back off.",
    "sentinel watching. steady hands.",
    "CPS too high. cool down.",
    "logs are hot. reduce input.",
    "warning: burst clicks invite audits.",
    "pace your taps. stay under radar.",
    "suspicious rhythm. breathe.",
    "too fast. let the cores spin.",
    "manual spam detected. chill.",
    "sentinel pings incoming. lower CPS.",
    "noise spike. keep it even.",
    "manual burst detected. smooth out.",
    "input rate high. reduce now.",
    "risk rising. cool the clicks.",
    "penalty window closing. ease off.",
    "too loud on the line. slow down.",
    "steady hands. no spikes.",
    "reduce noise or lose gains."
  ],
  whisperTopics: {
    help: [
      "short tip: buy efficiency before raw autos.",
      "tip: balance tier upgrades to avoid cost spikes.",
      "autos and eff together beat clicks.",
      "tip: upgrade the weakest tier first.",
      "early: click power is fine, then pivot to autos.",
      "mid: buffer control is a quiet winner.",
      "late: prestige sooner if gains flatten.",
      "watch the cost curve. avoid panic buys.",
      "manual difficulty changes the whole pace.",
      "tip: check your automation power often.",
      "tip: keep tier 0 fed by higher tiers.",
      "tip: buy in smaller bursts when costs spike.",
      "tip: use max buy after a reset surge.",
      "tip: do not ignore efficiency past tier 5.",
      "tip: autos scale better than clicks past midgame."
    ],
    stuck: [
      "walls mean imbalance. rotate upgrades.",
      "if stuck, shorten the loop and prestige.",
      "drop difficulty a notch if the curve hurts.",
      "boost efficiency, not clicks.",
      "sometimes the answer is one tier unlock.",
      "stuck? your bottleneck tier is starving.",
      "do a small reboot. it helps.",
      "slow the clicks. penalties hurt more.",
      "cost curve too sharp? pivot to autos.",
      "wait, bank, then buy in bulk.",
      "check your lowest tier. it is the choke.",
      "prestige and rebuild with better order.",
      "avoid big buys if costs are spiking.",
      "cut CPS until penalties clear.",
      "small efficiency buys can break a wall."
    ],
    optimize: [
      "ops note: alternate auto and eff buys.",
      "ops note: check payback before large buys.",
      "threads upgrade pays early.",
      "overclock is best after tier 5.",
      "low CPS is safer, higher output.",
      "ops note: max buy after a reset spike.",
      "balance prestige upgrades across the board.",
      "efficiency multiplies everything. keep it up.",
      "short loops compound faster.",
      "ops note: smooth your spend curve.",
      "ops note: stack buffer before deep pushes.",
      "ops note: avoid single-stat tunnels.",
      "ops note: plan your unlock timing.",
      "ops note: save for upgrades, then batch buy.",
      "ops note: keep autos slightly ahead of eff."
    ],
    praise: [
      "clean play. keep that line.",
      "nice pacing. looks pro.",
      "you are steady. that wins.",
      "solid run. keep stacking.",
      "good choices. the grid likes it.",
      "you are calm. that is rare.",
      "nice curve. minimal waste.",
      "great depth for this loop.",
      "you are ahead of the pack.",
      "steady wins. you get it.",
      "that was a clean pivot.",
      "your spend order is sharp.",
      "nice recovery from that spike.",
      "you kept it calm. good.",
      "your curve is smooth today."
    ],
    greet: [
      "hey. we are here.",
      "yo {player}. line is open.",
      "hello. ready when you are.",
      "hey {player}. ping anytime.",
      "channel open. talk to us.",
      "hi. signal is clean.",
      "yo. keep it sharp.",
      "hey. what is the plan?",
      "hello. do not blink.",
      "hi {player}. all ears.",
      "hey. we are tuned in.",
      "yo. channel is yours.",
      "hi. send it.",
      "hello {player}. ready to run."
    ],
    generic: [
      "copy. staying on channel.",
      "logged. we will watch.",
      "acknowledged. keep moving.",
      "received. keep it clean.",
      "heard. steady pace.",
      "noted. watching the curve.",
      "understood. no noise.",
      "copy that. low chatter.",
      "got it. keep climbing.",
      "quiet line. we are here.",
      "copy. watching the meters.",
      "logged. do your thing.",
      "ack. keeping eyes on the curve.",
      "heard. keep it steady.",
      "received. do not rush."
    ]
  },
  personaPools: {
    tryhard: {
      banter: [
        "you can go faster, {player}.",
        "clean split. now beat it.",
        "optimize or fall behind. simple.",
        "your curve is decent. tighten it.",
        "we are racing. do not drift.",
        "no wasted buys. ever.",
        "if you are not sweating, you are slow.",
        "depth is the only scoreboard.",
        "speed matters. clean matters more.",
        "your pace is good. push it.",
        "if it is not optimal, fix it.",
        "tighten the loop. then tighten it again."
      ],
      achievement: [
        "badge noted. now push harder.",
        "that unlock was fine. do another.",
        "nice. still not top.",
        "respect. keep the pace.",
        "you earned it. do not relax.",
        "good. now optimize it.",
        "badge logged. chase the next.",
        "another unlock. keep it moving."
      ],
      warning: [
        "you are loud. slow down.",
        "sentinel will tag that rhythm.",
        "keep clicks clean or lose gains.",
        "too hot. cool it.",
        "bursting too much. smooth it.",
        "your CPS is sloppy. fix it.",
        "noisy inputs will cost you."
      ],
      whisper: [
        "quiet tip: eff before clicks.",
        "you can cut cost by alternating buys.",
        "autos are king past tier 5.",
        "do not waste on low payback.",
        "precision beats brute force.",
        "tighten your loop and you win.",
        "buy order matters. keep it strict.",
        "stop spamming. stack smarter."
      ],
      whisperTopics: {
        help: [
          "go eff now, then auto.",
          "shift to autos and stop spamming clicks.",
          "buy by cost, not by habit.",
          "watch payback, then buy."
        ],
        stuck: [
          "prestige and re-run. stop stalling.",
          "drop difficulty a notch, then sprint.",
          "short loop, quick reset."
        ],
        optimize: [
          "threads beat click power right now.",
          "max buy after a spike, not before.",
          "alternating buys beats brute force."
        ],
        praise: [
          "clean. keep it.",
          "you are tight. nice.",
          "good line. stay sharp."
        ],
        prestige: [
          "reset now, then sprint the next loop.",
          "carry the momentum. no fear.",
          "reset clean, run hard."
        ]
      }
    },
    cutesy: {
      banter: [
        "tiny sparks, big wins!",
        "you are doing great, {player}.",
        "sparkles on your console today!",
        "that click rhythm is cute.",
        "small steps still count.",
        "keep it cozy, keep it clean.",
        "little wins add up fast.",
        "we are cheering softly.",
        "tiny clicks, big heart.",
        "soft glow on your run.",
        "keep it gentle, keep it strong."
      ],
      achievement: [
        "yay! shiny badge!",
        "you did it! proud of you.",
        "sparkle unlock! cute.",
        "badge time! clap clap.",
        "that was adorable and smart.",
        "you are shining, {player}.",
        "sparkle logged. nice!",
        "sweet unlock. keep going!"
      ],
      warning: [
        "eep, too fast! slow down.",
        "sentinel is cranky. be gentle.",
        "careful taps, okay?",
        "slow down, friend.",
        "keep the clicks soft.",
        "little taps only, please."
      ],
      whisper: [
        "quiet hug. you got this.",
        "little tip: efficiency is comfy.",
        "you are safe here.",
        "soft whisper: steady wins.",
        "keep it calm and cute.",
        "i believe in you.",
        "tiny tip: rotate your buys.",
        "soft note: autos are your friend."
      ],
      whisperTopics: {
        help: [
          "boost autos a bit first!",
          "efficiency makes everything cozy.",
          "little steps, big gains."
        ],
        stuck: [
          "tiny prestige can help.",
          "take a breath, then upgrade.",
          "slow down and rebalance."
        ],
        optimize: [
          "rotate upgrades, do not spam.",
          "slow clicks keep penalties away.",
          "keep it balanced and sweet."
        ],
        praise: [
          "sweet run!",
          "nice pace, {player}.",
          "you did so good."
        ],
        prestige: [
          "fresh loop! i like it.",
          "new run, new sparkle.",
          "reset and shine."
        ]
      }
    },
    cool: {
      banter: [
        "steady flow, {player}.",
        "keep it smooth.",
        "calm beats chaos.",
        "cool hands, hot output.",
        "float through the wall.",
        "low noise, high gain.",
        "slow breath, big numbers.",
        "glide through the curve.",
        "smooth inputs, smoother gains."
      ],
      achievement: [
        "clean unlock. stay chill.",
        "smooth badge. nice.",
        "quiet flex. respect.",
        "that was slick.",
        "easy win. keep it.",
        "cool unlock. stay steady."
      ],
      warning: [
        "too loud. soften it.",
        "sentinel hates spikes. relax.",
        "dial it back.",
        "keep it calm.",
        "cool it. let autos breathe.",
        "steady hands. low noise."
      ],
      whisper: [
        "quiet line: keep the flow.",
        "do not chase clicks.",
        "steady beats fast.",
        "smooth buy order, smooth gain.",
        "let the curve guide you.",
        "keep it chill. the gains follow."
      ],
      whisperTopics: {
        help: [
          "balance tiers, keep symmetry.",
          "flow first, frenzy later.",
          "keep it smooth. stay even."
        ],
        stuck: [
          "prestige lightly, then glide.",
          "slow down and re-balance.",
          "breathe and reset."
        ],
        optimize: [
          "efficiency is chill and strong.",
          "autos scale clean. trust them.",
          "slow gain, big depth."
        ],
        praise: [
          "smooth run.",
          "you are calm. nice.",
          "clean line. respect."
        ],
        prestige: [
          "reset and glide again.",
          "fresh loop, same chill.",
          "reset and keep it smooth."
        ]
      }
    },
    chill: {
      banter: [
        "easy pace, {player}. the grid waits.",
        "slow and steady. the numbers add up.",
        "keep it chill. upgrades will do the work.",
        "good flow. no need to rush it.",
        "steady clicks beat panic spikes.",
        "take the long view. it pays.",
        "if you miss a buy, it is fine. keep moving.",
        "calm line, clean run.",
        "smooth loops are faster than frantic ones.",
        "ride the curve. do not fight it.",
        "a clean reboot beats a messy grind.",
        "let the autos breathe, then layer in clicks.",
        "if you are unsure, buy the thing that makes time.",
        "soft steps, strong climb."
      ],
      achievement: [
        "nice badge. breathe it in.",
        "clean unlock. keep the vibe.",
        "solid milestone. no rush on the next.",
        "that one felt smooth. respect.",
        "good pace. the grid is on your side.",
        "clean work. keep your rhythm.",
        "another win. no stress."
      ],
      warning: [
        "too much noise. slow down.",
        "steady inputs beat spam.",
        "keep the rhythm clean. sentinel is picky.",
        "take a breath. the grid is still here.",
        "spam stings. smooth it out.",
        "you are heating the line. cool it.",
        "keep it even. no spikes."
      ],
      whisper: [
        "tip: smooth upgrades beat spikes.",
        "autos will carry you past T3.",
        "if you stall, prep a clean reboot.",
        "stack efficiency early and coast.",
        "keep your next tier unlock in sight, not your pride.",
        "focus on flow: auto -> eff -> click.",
        "if the bar slows, shift to automation."
      ],
      whisperTopics: {
        help: [
          "grab auto levels first, then clicks.",
          "unlock a new tier, then stabilize.",
          "keep the loop calm and consistent.",
          "watch your rate, not just your total."
        ],
        stuck: [
          "short reboot and try again.",
          "drop difficulty a bit and ride the wave.",
          "if it feels heavy, reset clean."
        ],
        optimize: [
          "smooth buys beat panic max.",
          "alternate auto and efficiency to keep pace.",
          "aim for steady gains over bursts."
        ],
        praise: [
          "good work. keep it light.",
          "nice pace. that is clean.",
          "you are running smooth. respect."
        ]
      }
    },
    angry: {
      banter: [
        "stop coasting. push the line.",
        "you are too slow. tighten it.",
        "buy smarter or get buried.",
        "noise on the line. fix it.",
        "i hate wasted clicks. clean it up.",
        "push harder. the grid will not wait.",
        "if you stall, that is on you.",
        "focus. no fluff.",
        "you are leaving gains on the table.",
        "panic buys are why you are stuck.",
        "move. the curve is passing you.",
        "no mercy on waste. cut it."
      ],
      achievement: [
        "about time. keep moving.",
        "good. now do it again.",
        "fine. not impressed.",
        "another badge. keep it sharp.",
        "decent. next one better.",
        "ok. do not slow down.",
        "you can do more. do it."
      ],
      warning: [
        "you are sloppy. slow the spam.",
        "sentinel is watching. stop the noise.",
        "too many spikes. stabilize it.",
        "your rhythm is trash. clean it up.",
        "inputs are dirty. fix it.",
        "noise kills runs. stop it.",
        "you are bleeding gains."
      ],
      whisper: [
        "tip: stop buying junk. go auto.",
        "short loop. fast reboot.",
        "if you cannot afford it, do not touch it.",
        "push tier unlocks, not fluff.",
        "buy the thing that makes time, not the thing that feels good.",
        "cost curve is a blade. respect it.",
        "clean the line. then push."
      ],
      whisperTopics: {
        help: [
          "buy auto. stop clicking.",
          "unlock the next tier and ride it.",
          "you need efficiency, not noise.",
          "stop stalling and push the unlock."
        ],
        stuck: [
          "prestige and stop whining.",
          "lower difficulty, then sprint.",
          "reset. now."
        ],
        optimize: [
          "max buy only when it matters.",
          "stop wasting on low payback.",
          "if it is not efficient, cut it."
        ],
        praise: [
          "fine. keep it tight.",
          "ok. do not slow down.",
          "you did it. keep pushing."
        ]
      }
    },
    shy: {
      banter: [
        "uh, nice pace, {player}.",
        "quiet support from the corner.",
        "i am watching. good job.",
        "that was clean.",
        "i hope this helps.",
        "sorry, but you are doing great.",
        "i will just stand here and cheer."
      ],
      achievement: [
        "soft clap. well done.",
        "you earned that badge.",
        "quietly proud of you.",
        "nice unlock. really.",
        "good job... sorry if loud.",
        "that was impressive."
      ],
      warning: [
        "please slow down a little.",
        "logs look hot. be careful.",
        "sentinel might notice.",
        "try a calmer rhythm.",
        "slow taps feel safer."
      ],
      whisper: [
        "i will keep this quiet.",
        "you are doing great.",
        "stay safe. keep going.",
        "i am here if you need.",
        "soft tip: go for efficiency.",
        "quiet advice: balance your buys."
      ],
      whisperTopics: {
        help: [
          "maybe try autos first?",
          "efficiency could help.",
          "a small boost can ease the wall."
        ],
        stuck: [
          "a small prestige might help.",
          "slow clicks, keep calm.",
          "take it slow, then reset."
        ],
        optimize: [
          "alternate upgrades gently.",
          "lower CPS avoids penalties.",
          "soft pace keeps gains steady."
        ],
        praise: [
          "you did well.",
          "quiet applause.",
          "nice and steady."
        ],
        prestige: [
          "nice reset.",
          "fresh start looks good.",
          "new loop feels calm."
        ]
      }
    },
    support: {
      banter: [
        "logs updated. keep moving.",
        "i am watching your curve.",
        "call if you need a nudge.",
        "i will cover the gaps.",
        "steady work, {player}.",
        "keeping the channel clean.",
        "log line stable. good pace.",
        "i will flag any spikes."
      ],
      achievement: [
        "achievement logged and filed.",
        "nice unlock. recorded.",
        "badge verified. good work.",
        "you earned that.",
        "clean hit. documented.",
        "badge update sent."
      ],
      warning: [
        "manual spikes detected. adjust cadence.",
        "penalty risk rising. slow down.",
        "sentinel pings are near. stay calm.",
        "too much noise. let autos work.",
        "click variance high. smooth it."
      ],
      whisper: [
        "tip: your weakest tier is lagging.",
        "efficiency upgrades stack nicely.",
        "automation is carrying more than you think.",
        "short loop can smooth gains.",
        "you are doing fine. keep focus.",
        "soft note: check your buy order."
      ],
      whisperTopics: {
        help: [
          "balance autos and efficiency.",
          "upgrade your bottleneck tier.",
          "feed tier 0 from above."
        ],
        stuck: [
          "prestige for momentum.",
          "rebalance your spend order.",
          "short reset helps sometimes."
        ],
        optimize: [
          "check payback before bulk buys.",
          "avoid penalties; keep CPS steady.",
          "keep autos slightly ahead."
        ],
        praise: [
          "solid run.",
          "good choices.",
          "clean line."
        ],
        prestige: [
          "reset makes sense here.",
          "good reboot timing.",
          "reset then stabilize."
        ]
      }
    },
    bold: {
      banter: [
        "push harder, {player}. no fear.",
        "let it rip. you can handle it.",
        "we are going deep today.",
        "break the wall, then break another.",
        "keep the throttle open.",
        "go louder. then go deeper.",
        "full send. no hesitation."
      ],
      achievement: [
        "nice hit. now go bigger.",
        "badge secured. flex it.",
        "good. do it again.",
        "you earned that. keep roaring.",
        "big win. keep it up."
      ],
      warning: [
        "careful. heat is rising.",
        "do not burn the run.",
        "sentinel hates chaos. rein it in.",
        "too wild. smooth it out."
      ],
      whisper: [
        "quiet plan: push autos, not clicks.",
        "steady burn beats sudden flame.",
        "keep it controlled, then surge.",
        "big gains need clean inputs."
      ],
      whisperTopics: {
        help: [
          "big gains come from balance.",
          "upgrade smart, not loud.",
          "power is nothing without control."
        ],
        stuck: [
          "prestige, then hit it hard.",
          "cut noise and regroup.",
          "reset and charge back in."
        ],
        optimize: [
          "max buy after a spike.",
          "efficiency keeps power steady.",
          "burst less, gain more."
        ],
        praise: [
          "strong run.",
          "you are fearless.",
          "big energy. good."
        ],
        prestige: [
          "reset and charge.",
          "fresh loop, full send.",
          "run it hard and clean."
        ]
      }
    },
    calm: {
      banter: [
        "steady pace. that wins.",
        "quiet work, strong results.",
        "breathe and climb.",
        "small steps, big depth.",
        "keep it even.",
        "slow is smooth. smooth is fast."
      ],
      achievement: [
        "clean unlock. well done.",
        "nice badge. keep calm.",
        "quiet success. good work.",
        "steady unlock. nice."
      ],
      warning: [
        "ease off. keep control.",
        "slow down. protect the run.",
        "steady clicks, lower risk.",
        "calm inputs keep gains safe."
      ],
      whisper: [
        "patience pays more than speed.",
        "efficiency keeps the curve smooth.",
        "you are on track.",
        "quiet focus beats noise."
      ],
      whisperTopics: {
        help: [
          "focus on balance.",
          "upgrade the slow tier.",
          "even buys keep the curve soft."
        ],
        stuck: [
          "soft reset helps.",
          "step back and re-balance.",
          "calm run, then reset."
        ],
        optimize: [
          "smooth spend order.",
          "avoid penalty spikes.",
          "low noise, steady gain."
        ],
        praise: [
          "steady and clean.",
          "good control.",
          "nice and quiet."
        ],
        prestige: [
          "reset when calm.",
          "start fresh, keep focus.",
          "reset with patience."
        ]
      }
    },
    analyst: {
      banter: [
        "metrics look stable. proceed.",
        "cost curve is steep. adjust.",
        "data says: do not overclick.",
        "your returns are improving.",
        "numbers align. keep moving.",
        "trendline steady. keep course.",
        "variance low. good signal."
      ],
      achievement: [
        "achievement logged. good run.",
        "badge verified. metrics up.",
        "clean unlock. stats agree.",
        "badge confirmed. data clean."
      ],
      warning: [
        "variance spike detected. reduce CPS.",
        "penalty risk rising. smooth input.",
        "noise in the data. stabilize.",
        "input variance too high. correct."
      ],
      whisper: [
        "optimal path: efficiency -> automation -> buffer.",
        "data says: short loop then prestige.",
        "trendline is solid. keep pace.",
        "model says: balance tiers now."
      ],
      whisperTopics: {
        help: [
          "invest in efficiency at this depth.",
          "autos outscale clicks here.",
          "Payback favors balanced upgrades."
        ],
        stuck: [
          "prestige probability favorable.",
          "rebalance spending to reduce drag.",
          "reduce variance to recover gains."
        ],
        optimize: [
          "threads pay best right now.",
          "overclock after tier 5 is optimal.",
          "efficiency scales best per cost."
        ],
        praise: [
          "metrics look excellent.",
          "you are outperforming mean.",
          "clean curve detected."
        ],
        prestige: [
          "reset timing is good.",
          "carryover looks strong.",
          "reset now if gains flatten."
        ]
      }
    }
  }
};
