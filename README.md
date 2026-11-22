# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chuachua3225-pixel/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chuachua3225-pixel/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**PeerLens** — a token launch radar that prices protocols whose token does not exist yet by the
peers that already trade. Instead of one flat multiple of TVL, the model (`lib/model.ts`,
`peerlens-2`) calibrates each category from the snapshot itself: the median market-cap / TVL of
that category's live-token protocols, winsorised and shrunk in log space toward the global median
when peers are few, is the multiple a pre-token protocol in that category is priced with. Momentum
(7-day TVL change), maturity (how long the protocol has run with no token) and breadth (chain
count) adjust it, and the peers' interquartile range becomes a value band under every number, with
a confidence grade from the peer count.

The board covers the snapshot's whole watchlist and goes below its $50M floor: every pre-token
protocol that is not a derivative of a token that already trades (wrapped, staked, bridged and
exchange products are excluded at every size) — 198 rows on the sealed 2026-11-14 snapshot, each
with a seven-step farm plan whose action, capital, gas and hold are derived from the protocol's
category, first chain, TVL and age. The dashboard (`dashboard/`) is a static page that renders with
no network: a sortable, filterable board (search, category, chain, minimum TVL, watchlist-only),
a detail view for every protocol with its valuation breakdown and the live peers that set its
price, and a Live token tab that sets the already-trading protocols aside — the same set the model
calibrates from. The page recomputes every row's implied value from the figures it shows and
checks it against `board.json`.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes `out/board.json`,
`out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Open
`out/dashboard/index.html` in a browser to use the radar.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6nw3px4a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
