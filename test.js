#!/usr/bin/env node
/* Big Two engine tests. No dependencies: extracts the game's script from
   index.html, runs it in Node with a stub DOM and a seeded RNG, and asserts
   rules, counting, scoring, persistence guards, and bot quality.
   Run: node test.js */
const fs = require("fs");

// --- harness ---------------------------------------------------------------
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const script = html.match(/<script>\n"use strict";([\s\S]*?)<\/script>/)[1];

/* Minimal DOM: enough that class marking, child lists, and querySelector behave
   like the browser, so render guards can be tested rather than assumed. */
function el() {
  const classes = new Set();
  const node = {
    textContent: "", children: [], parent: null, dataset: {},
    style: { setProperty(){} },
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, on) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : on ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c)
    },
    setAttribute(){}, addEventListener(){},
    appendChild(c) { c.parent = node; node.children.push(c); return c; },
    remove() { const p = node.parent; if (p) p.children = p.children.filter(c => c !== node); },
    querySelector(sel) { return node.children.find(c => c.classList.contains(sel.replace(".", ""))) || null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 52, height: 74 })
  };
  Object.defineProperty(node, "innerHTML", {
    get: () => "", set: (v) => { if (v === "") node.children = []; }
  });
  return node;
}
const stubs = {
  document: (() => {
    const byId = {};
    return {
      getElementById: (id) => (byId[id] = byId[id] || el()),
      createElement: () => el(),
      body: el(),
      querySelector: () => el(),
      _byId: byId
    };
  })(),
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  confirm: () => true,
  matchMedia: () => ({ matches: true }),
  addEventListener: () => {},
  setTimeout: (fn) => { if (typeof fn === "function") fn(); return { unref(){} }; },
  clearTimeout: () => {}
};
for (const k of Object.keys(stubs)) Object.defineProperty(global, k, { value: stubs[k], configurable: true, writable: true });
Object.defineProperty(global, "navigator", { value: {}, configurable: true });

// Seeded RNG: every run identical.
let seed = 0x2F6E2B1;
Math.random = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

/* The game keeps its state in let/const bindings, which direct eval does not
   expose. Appending an accessor object that closes over those bindings gives
   the tests a handle on everything without changing the game file. */
const G = eval(script + `
;({
  classify, beats, isLegal, unseenHigher, botChoose,
  newMatch, startHand, applyPlay, applyPass,
  loadMatch, loadCareer, MATCH_LEN, selectedCombo, val, renderHand, animateHandPlay,
  saveHand, loadHand, botChoose: botChoose, setSound, sfx,
  get audio(){ return audio; },
  get match(){ return match; },
  get state(){ return state; },
  set state(v){ state = v; },
  set difficulty(d){ difficulty = d; }
});`);

let failures = 0;
const check = (name, ok) => {
  console.log((ok ? "  ok  " : "  FAIL") + " " + name);
  if (!ok) failures++;
};
const c = (r, s) => ({ r, s });

// --- rules -------------------------------------------------------------------
console.log("rules");
check("A-high straight classifies", G.classify([c(7,0),c(8,1),c(9,2),c(10,3),c(11,0)])?.cat === 0);
check("2 cannot appear in a straight", G.classify([c(8,0),c(9,1),c(10,2),c(11,3),c(12,0)]) === null);
check("straight flush is cat 4", G.classify([c(0,3),c(1,3),c(2,3),c(3,3),c(4,3)])?.cat === 4);
check("full house strength is the triple's rank", G.classify([c(5,0),c(5,1),c(5,2),c(9,0),c(9,1)])?.strength === 5);
check("quads with kicker is cat 3", G.classify([c(6,0),c(6,1),c(6,2),c(6,3),c(0,0)])?.cat === 3);
check("mixed sizes never beat each other", G.beats(G.classify([c(12,3)]), G.classify([c(3,0),c(3,1)])) === false);
check("higher suit wins equal rank", G.beats(G.classify([c(9,3)]), G.classify([c(9,0)])) === true);
check("flush beats straight", G.beats(
  G.classify([c(0,2),c(2,2),c(4,2),c(6,2),c(8,2)]),
  G.classify([c(7,0),c(8,1),c(9,2),c(10,3),c(11,3)])) === true);
check("first move must include the 3♦",
  G.isLegal(G.classify([c(5,0)]), null, true) === false &&
  G.isLegal(G.classify([c(0,0)]), null, true) === true);

// --- card counting -------------------------------------------------------------
console.log("card counting");
G.state = { seen: new Set(), hands: [[], [], [], []] };
check("2♠ is always boss", G.unseenHigher(51, [], []) === 0);
G.state = { seen: new Set([44,45,46,47,48,49,50,51]), hands: [[], [], [], []] }; // aces and 2s all seen
check("K♠ becomes boss once 2s and aces are seen", G.unseenHigher(43, [], []) === 0);
check("own hand counts as seen from its owner's view", G.unseenHigher(39, [c(10,3)], []) === (51-39) - 8 - 1);
check("about-to-play cards count via extra", G.unseenHigher(39, [], [43]) === (51-39) - 8 - 1);

// --- full matches ----------------------------------------------------------------
console.log("matches");
function playMatch() {
  G.newMatch();
  let guard = 0;
  while (G.match.hand < G.MATCH_LEN && guard++ < 60000) {
    if (G.state.over) { G.startHand(); continue; }
    const s = G.state.turn, p = G.botChoose(s);
    if (p) G.applyPlay(s, p); else G.applyPass(s);
  }
  return G.match.scores.slice();
}
for (const d of ["easy", "medium", "hard"]) {
  G.difficulty = d;
  const scores = playMatch();
  check(`${d}: full match completes zero-sum`, scores.reduce((a, b) => a + b, 0) === 0);
}

// --- bot quality: seat-mixed difficulties over many matches -----------------------
console.log("bot quality");
const modes = ["easy", "medium", "hard", "medium"];
const totals = [0, 0, 0, 0];
for (let m = 0; m < 30; m++) {
  G.newMatch();
  let guard = 0;
  while (G.match.hand < G.MATCH_LEN && guard++ < 60000) {
    if (G.state.over) { G.startHand(); continue; }
    const s = G.state.turn;
    G.difficulty = modes[s];
    const p = G.botChoose(s);
    if (p) G.applyPlay(s, p); else G.applyPass(s);
  }
  totals.forEach((_, i) => totals[i] += G.match.scores[i]);
}
const avg = { easy: totals[0] / 30, medium: (totals[1] + totals[3]) / 60, hard: totals[2] / 30 };
console.log(`  avg/match  easy ${avg.easy.toFixed(1)}  medium ${avg.medium.toFixed(1)}  hard ${avg.hard.toFixed(1)}`);
check("hard outscores medium", avg.hard > avg.medium);
check("hard outscores easy", avg.hard > avg.easy);

// --- selection identity (regression: selection must survive a stale hand layout) ---
console.log("selection");
G.newMatch();
{
  const hand = G.state.hands[0];
  const target = hand[hand.length - 1];       // last card: the most index-fragile one
  G.state.sel.add(G.val(target));
  hand.splice(0, 1);                          // drop the first card: every index shifts down
  const combo = G.selectedCombo();
  check("selection tracks the card, not its position",
    !!combo && combo.cards.length === 1 && G.val(combo.cards[0]) === G.val(target));
  G.state.sel.clear();
  G.state.sel.add(G.val(hand[0]));
  hand.splice(0, 1);                          // now remove the selected card itself
  check("a card that leaves the hand drops out of the selection", G.selectedCombo() === null);
  G.state.sel.clear();
}

// --- play animation (regression: the hand must not be rebuilt out from under a departing card) ---
console.log("play animation");
G.newMatch();
{
  const handEl = global.document._byId.hand;
  const realTimeout = global.setTimeout;
  global.setTimeout = () => ({});             // hold the deferred cleanup so we can inspect mid-flight
  const before = handEl.children.length;
  handEl.children[0].classList.add("sel");    // pretend the first card is raised
  G.animateHandPlay();
  check("the departing card is marked in the same tick", !!handEl.querySelector(".leaving"));
  G.state.hands[0].shift();                   // the model moves on, as applyPlay would
  G.renderHand();
  check("renderHand leaves the departing card alone",
    handEl.children.length === before && !!handEl.querySelector(".leaving"));
  global.setTimeout = realTimeout;
}

// --- mid-hand persistence (a suspended app must not lose the hand) ---
console.log("hand persistence");
{
  let saved = null;
  global.localStorage.setItem = (k, v) => { if (k === "big2-hand") saved = v; };
  global.localStorage.getItem = (k) => (k === "big2-hand" ? saved : null);
  G.newMatch();
  G.difficulty = "medium";
  // play a few turns so there's a real position to restore
  for (let i = 0; i < 6; i++) {
    if (G.state.over) break;
    const s = G.state.turn, p = G.botChoose(s);
    if (p) G.applyPlay(s, p); else G.applyPass(s);
  }
  const want = {
    hands: G.state.hands.map(h => h.map(G.val)),
    turn: G.state.turn,
    owner: G.state.owner,
    current: G.state.current ? G.state.current.cards.map(G.val) : null,
    plays: G.state.plays.length,
    seen: [...G.state.seen].sort((a, b) => a - b)
  };
  const restored = G.loadHand();
  check("a hand in progress can be restored", !!restored);
  if (restored) {
    const got = {
      hands: restored.hands.map(h => h.map(G.val)),
      turn: restored.turn,
      owner: restored.owner,
      current: restored.current ? restored.current.cards.map(G.val) : null,
      plays: restored.plays.length,
      seen: [...restored.seen].sort((a, b) => a - b)
    };
    check("restores the exact table position", JSON.stringify(got) === JSON.stringify(want));
  } else check("restores the exact table position", false);

  saved = JSON.stringify({ atHand: 0, hands: [[{ r: 99, s: 0 }], [], [], []], turn: 0, owner: -1, current: null, seen: [], plays: [] });
  check("a corrupt snapshot is rejected", G.loadHand() === null);
  saved = JSON.stringify({ atHand: 99, hands: [[{ r: 0, s: 0 }], [], [], []], turn: 0, owner: -1, current: null, seen: [], plays: [] });
  check("a snapshot from another hand is rejected", G.loadHand() === null);
  global.localStorage.setItem = () => {};
  global.localStorage.getItem = () => null;
}

// --- sound (must degrade silently where there's no audio engine) ---
console.log("sound");
{
  let pref = null;
  global.localStorage.setItem = (k, v) => { if (k === "big2-sound") pref = v; };
  check("sound is on by default", G.audio.on === true);
  G.setSound(false);
  check("muting persists", pref === "off" && G.audio.on === false);
  G.setSound(true);
  check("unmuting persists", pref === "on" && G.audio.on === true);
  let threw = false;
  try { G.sfx.play(2); G.sfx.deal(); G.sfx.win(); G.sfx.pass(); } catch (e) { threw = true; }
  check("every sound is a no-op without an audio engine", !threw);
  global.localStorage.setItem = () => {};
}

// --- persistence guards ------------------------------------------------------------
console.log("persistence");
global.localStorage.getItem = () => JSON.stringify({ scores: ["a"], hand: 0, lastWinner: -1 });
check("corrupt match save rejected", G.loadMatch() === null);
global.localStorage.getItem = () => JSON.stringify({ matches: 2, won: 5 });
check("impossible career save rejected", G.loadCareer() === null);

// -------------------------------------------------------------------------------------
console.log(failures ? `\n${failures} failure(s)` : "\nall tests passed");
process.exit(failures ? 1 : 0);
