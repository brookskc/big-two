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
- First player to empty their hand wins. No 2s in straights, no wraparound.

## Bots

You play against three heuristic bots (Mei, Old Chan, and Wing). They dump low cards when leading, play the cheapest hand that beats the table, hold their 2s early, avoid breaking up pairs, and turn aggressive once anyone is down to three cards.

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
