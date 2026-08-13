# Big Two 大老二

An offline, ad-free [Big Two](https://en.wikipedia.org/wiki/Big_two) card game for your phone. No accounts, no ads, no network calls, no tracking. Just cards.

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
- First player to empty their hand wins the hand. No 2s in straights, no wraparound.

## Scoring

Games are played as **sets of 10 hands** with traditional settlement scoring: when someone goes out, each other player pays the winner for the cards left in their hand, with multipliers for getting caught heavy. Losers go negative, the winner collects the sum, and every hand is zero-sum:

| Cards left | Penalty |
|---|---|
| 1–7 | 1 point per card |
| 8–9 | 2 points per card |
| 10–12 | 3 points per card |
| 13 | 4 points per card |

Highest total after 10 hands wins the set. Ties break by most hands won, then most recent hand won (Big 2 has no official governing rules; this is the common convention among digital implementations). The winner of each hand leads the next one; the 3♦ rule applies only to a set's opening hand. Set scores persist in localStorage, so you can close the app mid-set and pick it back up.

## Bots

You play against Mei, Old Chan, and Wing. Three difficulty modes, selectable in-game and fully deterministic (no coin flips):

- **Easy** answers with the cheapest legal play, never passes by choice, and leads its lowest single.
- **Medium** plays the cheapest legal answer but protects its 2s and intact pairs with fixed rules, and dumps low cards in big shapes when leading.
- **Hard** runs a hand-strength evaluator: it greedily partitions its hand into the fewest plays needed to empty it, values control cards (2s, aces), penalizes hoarding (the score multipliers punish getting caught heavy), and decides whether to pass by comparing the structural cost of the cheapest answer against the tempo value of staying in the trick. It also plays endgame denial, beating singles with its tallest card when someone is nearly out.

In a 250-hand simulation, hard gives up markedly fewer points per set than medium, and medium fewer than easy.

## Tech

- Single `index.html`: vanilla JavaScript, no frameworks, no build step, no dependencies.
- `sw.js` + `manifest.webmanifest` make it an installable PWA with cache-first offline support.
- Runs entirely client-side. Nothing ever leaves your device.

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

MIT. See [LICENSE](LICENSE).
