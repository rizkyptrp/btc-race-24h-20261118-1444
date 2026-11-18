# btc-race-24h-20261118-1444 — slow trend follower for cbBTC/USDC

Entry for the make.fun bounty "Race a BTC trading bot live for 24 hours"
($250, 1st $60). The bot trades Coinbase Wrapped BTC against USDC on
1-minute on-chain bars, starting with $1,000 of paper money, long only.

## Strategy

Flat most of the time; it only rides a slow, confirmed recovery:

- **Buy** when the 120-bar SMA of closes crosses above the 240-bar SMA
  **and** the close is at least 30 bps above the close 60 bars ago.
  One position, full cash.
- **Sell** at +150 bps take-profit vs the entry fill price, −100 bps
  stop-loss, the fast average crossing back below the slow one, or after
  240 bars held. No new entry in the last 120 bars.

All arithmetic is `BigInt` on the raw integer prices: two runs on the same
bars produce byte-identical orders. No clock, no randomness, no network,
no files outside the repo. Standard library only, plus the kit's bars shim
vendored under `vendor/`.

## Run

```sh
node main.ts
```

It speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout):
a `hello`, one `batch` per bar, then `done`. Grade locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this repo> --driver docker
```

## Dev-window result

See the grade-local output: the entry passes the dev gate (net PnL > $0
after all fees) with a small number of trades and a maximum drawdown far
below the 25% guardrail.
