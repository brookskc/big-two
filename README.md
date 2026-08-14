# Big Two 大老二

An offline, ad-free [Big Two](https://en.wikipedia.org/wiki/Big_two) card game for your phone. No accounts, no ads, no network calls, no tracking. Just cards.

The code is public and free for noncommercial use. See [License](#license).

Built because every Big 2 app on the App Store is buried in ads.

## Play it

Once deployed to GitHub Pages, open the URL in Safari, then **Share → Add to Home Screen**. It installs like an app and works fully offline from then on.

## Rules

Standard Hong Kong rules:

- 4 players, 13 cards each. The player holding the 3♦ leads the first trick and must include it.
- Rank order: 3 4 5 6 7 8 9 10 J Q K A **2** (2 is highest).
- Suit order: ♦ < ♣ < ♥ < ♠.
- Legal plays: singles, pairs, triples, and five-card poker hands (straight < flush < full house < four of a kind < straight flush).
- You must beat the current play with the same number of cards, or pass. When all three others pass, the table clears and the last player leads anything.
- First player to empty their hand wins the hand. No 2s in straights, no wraparound; flushes compare by their highest card.

## Scoring

Games are played as **matches of 10 hands** with traditional settlement scoring: when someone goes out, each other player pays the winner for the cards left in their hand, with multipliers for getting caught heavy. Losers go negative, the winner collects the sum, and every hand is zero-sum:

| Cards left | Penalty |
|---|---|
| 1–7 | 1 point per card |
| 8–9 | 2 points per card |
| 10–12 | 3 points per card |
| 13 | 4 points per card |

Highest total after 10 hands wins the match. Ties break by most hands won, then most recent hand won (Big 2 has no official governing rules; this is the common convention among digital implementations). The winner of each hand leads the next one; the 3♦ rule applies only to a match's opening hand. Scores and the hand in progress both persist in localStorage, so you can navigate away, or have the app suspended mid-hand, and come back to the exact table position.

## Bots

You play against Kit, Chun, and Ming. Three difficulty modes, selectable in-game and fully deterministic (no coin flips):

- **Easy** answers with the cheapest legal play, never passes by choice, and leads its lowest single.
- **Medium** plays the cheapest legal answer but protects its 2s and intact pairs with fixed rules, and dumps low cards in big shapes when leading.
- **Hard** scores every legal option by the hand it would leave behind: a greedy partition into the fewest plays needed to go out, a cost for holding cards (the multipliers punish getting caught heavy), and control valued by what is actually still unseen, so a king counts as the boss card once both 2s and all four aces have hit the table. It never passes when it can legally play, because shedding wins under settlement scoring. It also plays endgame denial, beating singles with its tallest card when someone is nearly out.

Measured over 160 matches with the difficulties rotated through every seat across four decks: hard averages +47 points per match, medium −4, easy −40. `test.js` runs that measurement and fails if the ladder ever inverts.

## Tech

- Single `index.html`: vanilla JavaScript, no frameworks, no build step, no dependencies.
- `sw.js` + `manifest.webmanifest` make it an installable PWA with cache-first offline support.
- Runs entirely client-side. Nothing ever leaves your device.

The app also keeps a lifetime record of matches won, shown on the end-of-match screen.

## Sound

Every sound is synthesized at runtime with the Web Audio API — card snaps and the shuffle are filtered noise bursts, the win chime is a short arpeggio — so there are no audio files to download and the game stays a single self-contained file. The ♪ button mutes, and the choice persists.

## Tests

```bash
node test.js
```

No dependencies. The suite extracts the game's script straight out of `index.html`, runs it in Node with a stub DOM and a seeded RNG, and asserts the rules engine (hand classification, comparison, the 3♦ rule), the card counting, zero-sum settlement over full matches on every difficulty, bot quality (hard must outscore medium and easy over 30 seat-mixed matches), the mid-hand snapshot round-trip, and the persistence guards. Deterministic: every run plays the same cards.

## Develop

```bash
# any static server works
python3 -m http.server 8000
# open http://localhost:8000
```

Edit `index.html`, refresh. That's the whole workflow. If you change cached assets, bump the `CACHE` version string in `sw.js` so installed clients pick up the update.

## Deploy

This repo is meant for GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder.

## License

Copyright 2026 brookskc. Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md): you're welcome to read it, run it, study it, modify it, and share it for any noncommercial purpose. Commercial use requires a separate license from me.

Note that source-available is not the same as open source: PolyForm restricts commercial use, which the OSI definition does not permit.
