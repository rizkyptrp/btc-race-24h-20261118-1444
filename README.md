# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/rizkyptrp/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/rizkyptrp/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Slow SMA120/240 trend follower for cbBTC/USDC: it only rides a slow, confirmed recovery, long only, on 1-minute on-chain bars with $1,000 of paper money.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=67v2e6cq&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>

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

## Dev-window result

See the grade-local output: the entry passes the dev gate (net PnL > $0
after all fees) with a small number of trades and a maximum drawdown far
below the 25% guardrail.
