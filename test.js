#!/usr/bin/env node
/* Big Two engine tests. No dependencies: extracts the game's script from
   index.html, runs it in Node with a stub DOM and a seeded RNG, and asserts
   rules, counting, scoring, persistence guards, and bot quality.
   Run: node test.js */
const fs = require("fs");

// --- harness ---------------------------------------------------------------
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const script = html.match(/<script>\n"use strict";([\s\S]*?)<\/script>/)[1];

const el = () => ({
  innerHTML: "", textContent: "",
  classList: { add(){}, remove(){}, toggle(){} },
  setAttribute(){}, addEventListener(){}, appendChild(){},
  style: { setProperty(){} }, children: [], dataset: {}, remove(){}
});
const stubs = {
  document: { getElementById: () => el(), createElement: () => el(), body: el(), querySelector: () => el() },
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
  loadMatch, loadCareer, MATCH_LEN,
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

// --- persistence guards ------------------------------------------------------------
console.log("persistence");
global.localStorage.getItem = () => JSON.stringify({ scores: ["a"], hand: 0, lastWinner: -1 });
check("corrupt match save rejected", G.loadMatch() === null);
global.localStorage.getItem = () => JSON.stringify({ matches: 2, won: 5 });
check("impossible career save rejected", G.loadCareer() === null);

// -------------------------------------------------------------------------------------
console.log(failures ? `\n${failures} failure(s)` : "\nall tests passed");
process.exit(failures ? 1 : 0);
