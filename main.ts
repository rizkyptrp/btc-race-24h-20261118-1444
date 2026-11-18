// btc-race-24h-20261118-1444 — slow trend follower for cbBTC/USDC, 1-minute bars.
//
// The hello message carries the universe, capital, caps and fees. After it,
// every batch carries one bar for CBBTC plus the fills of the orders sent on
// the previous batch and the account. The bot answers each batch with exactly
// one reply: an array of orders (usually empty, at most one buy or one sell).
// Orders decided on a batch fill at the next bar's open, so every signal is
// judged on closes and pays the round-trip cost (about 26 bps) only when the
// move it catches is clearly bigger than that.
//
// Strategy, in one paragraph: be flat most of the time and only ride a slow,
// confirmed recovery. A buy needs the 120-bar simple moving average of closes
// to cross above the 240-bar average (a trend that has been building for
// hours, not a one-minute spike) AND the close to be at least 30 bps above
// the close 60 bars ago (the recovery is already under way, so a flat
// sideways cross does not trigger). One open position, full cash, long only.
// Exit on a take-profit of +150 bps against the entry fill price, a
// stop-loss of -100 bps, the fast average crossing back below the slow one,
// or after 240 bars held, whichever comes first. No new entry in the last
// 120 bars, so a late buy cannot be flattened at a loss by the window end.
//
// All arithmetic is BigInt on the raw integer prices, so two executions on
// the same bars produce byte-identical orders. No clock, no randomness, no
// network, no files, no environment reads. Standard library only, plus the
// kit's bars shim vendored under vendor/.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy constants (all in bar counts / basis points).
const FAST_WINDOW = 120; // fast SMA length, in bars
const SLOW_WINDOW = 240; // slow SMA length, in bars
const CONFIRM_WINDOW = 60; // momentum confirmation lookback, in bars
const CONFIRM_BPS = 30n; // close must beat the close 60 bars ago by this much
const TAKE_PROFIT_BPS = 150n; // exit a long at +150 bps vs its entry fill price
const STOP_LOSS_BPS = 100n; // exit a long at -100 bps vs its entry fill price
const MAX_HOLD_BARS = 240; // exit a long after this many bars, win or lose
const NO_ENTRY_LAST_BARS = 120; // do not open in the final stretch of the window
const MAX_SLIPPAGE_BPS = 200; // reject a fill that moved this far past the close
const TOTAL_BARS = 1440; // one-minute bars in a 24-hour window

// Return (a - b) * 10000 / b in basis points, truncated toward zero, or null
// when b is zero. BigInt division keeps this exact and deterministic.
function bpsChange(a: bigint, b: bigint): bigint | null {
  if (b === 0n) return null;
  return ((a - b) * 10000n) / b;
}

const closes: bigint[] = [];
let fastSum = 0n;
let slowSum = 0n;
let prevFastAboveSlow: boolean | null = null;
let entryBar = -1;

function onBatch(state: BarsState, batch: Batch) {
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];
  // Warm-up bars still count as history for the moving averages; only the
  // orders are held back while warming up (the harness rejects them anyway).
  const close = BigInt(bar.c);
  closes.push(close);
  fastSum += close;
  slowSum += close;
  if (closes.length > FAST_WINDOW) fastSum -= closes[closes.length - 1 - FAST_WINDOW];
  if (closes.length > SLOW_WINDOW) slowSum -= closes[closes.length - 1 - SLOW_WINDOW];
  if (state.warmingUp) return [];

  const position = state.positions.get(SYMBOL);
  const qty = position?.qty ?? 0n;
  const held = qty > 0n;
  const n = closes.length;

  // Track the trend state on every bar, flat or long, so a cross is never
  // missed or double-counted because an exit happened in between.
  // fastSum/120 > slowSum/240  <=>  fastSum * 2 > slowSum.
  let crossedUp = false;
  if (n >= SLOW_WINDOW) {
    const fastAboveSlow = fastSum * 2n > slowSum;
    crossedUp = prevFastAboveSlow === false && fastAboveSlow;
    prevFastAboveSlow = fastAboveSlow;
  }

  // --- exit logic, when long -------------------------------------------
  if (held && position !== undefined) {
    // Entry fill price, recovered exactly from the position's cost and qty:
    // cost = qty * price * 10^quote_scale / 10^(qty_scale + price_scale).
    const symbol = state.symbols.get(SYMBOL);
    if (symbol !== undefined) {
      const scaleUp = 10n ** BigInt(symbol.qty_scale + symbol.price_scale);
      const scaleDown = 10n ** BigInt(state.hello.capital.quote_scale);
      const entryPrice = (position.cost * scaleUp) / (qty * scaleDown);
      const ret = bpsChange(close, entryPrice);
      if (ret !== null && ret >= TAKE_PROFIT_BPS) {
        return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (ret !== null && ret <= -STOP_LOSS_BPS) {
        return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    if (entryBar >= 0 && n - entryBar >= MAX_HOLD_BARS) {
      return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    if (n >= SLOW_WINDOW) {
      // fast average below slow average: fastSum/120 < slowSum/240,
      // equivalently fastSum * 2 < slowSum.
      if (fastSum * 2n < slowSum) {
        return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  }

  // --- entry logic, when flat ------------------------------------------
  if (n < SLOW_WINDOW) return [];
  if (n > TOTAL_BARS - NO_ENTRY_LAST_BARS) return [];
  if (!crossedUp) return [];
  // Confirmation: the close must already be rising, not just drifting flat.
  const oldClose = closes[n - 1 - CONFIRM_WINDOW];
  const momentum = bpsChange(close, oldClose);
  if (momentum === null || momentum <= CONFIRM_BPS) return [];

  const cash = state.cash;
  if (cash <= 0n) return [];
  entryBar = n;
  return [{ side: 'buy' as const, symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

await runBars({ onBatch });
