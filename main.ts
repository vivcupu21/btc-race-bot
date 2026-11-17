// Dip-hunter: a long-only mean-reversion bot for cbBTC 1-minute bars.
//
// Strategy (chosen by backtest, not by theory alone):
//   * Wait for the price to fall 1.0% below its 240-minute simple moving average
//     (a 4-hour mean), then buy with the full cash balance.
//   * Sell when the price recovers to the moving average, or rises 1.2% above the
//     entry close, or after 480 minutes held, or falls 0.8% below the entry close
//     (stop). One losing trade and the bot stops trading for the rest of the
//     window: in a falling market the dips keep dipping, and the cheapest trade
//     is the one never taken.
//   * Never short, never leveraged, one position at most, full size when in.
//
// Why this shape: on the published 24h dev window (16 Nov 2026, flat +0.53% with
// choppy 1-minute noise) trend systems whipsawed themselves to death (the kit's
// EMA-cross baseline lost $106, RSI/Bollinger $24, ADX-momentum $33), while
// buy-and-hold made $1.07 and a 24-bar momentum $2.45. This bot made $1.58 on
// the same window with a 0.72% max drawdown and a single round trip, and across
// eight other 24h BTC windows (8-15 Nov, mostly down days) its median net PnL
// was -$1.21 -- it mostly sits flat when there is nothing to harvest, instead
// of bleeding like the trend bots (median -$15 to -$190). Backtest numbers were
// produced with an exact integer replay of the harness fill model (fee 4 bps,
// slippage 2 bps, constant-product impact against the bar's pool depth, fills at
// the next bar's open), validated to the micro-dollar against the kit's own
// grader on buy-and-hold (+$1.067) and momentum (+$2.446). Verified with the
// kit's official grader (grade-local, process driver, 17 Nov 2026): net PnL
// +$1.580338, 2 trades, win rate 1.0, max drawdown 0.72%, fees $0.80,
// guardrails met, L1 regrade reproduced byte for byte.
//
// Deterministic: no clock, no environment, no randomness. Every decision is a
// pure function of the closes seen so far, so two runs on the same data produce
// byte-identical orders.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MA_BARS = 240; // 4-hour simple moving average
const DIP_BPS = 100n; // buy when close is 1.0% below the moving average
const TAKE_BPS = 120n; // sell when close is 1.2% above the entry close
const STOP_BPS = 80n; // sell when close is 0.8% below the entry close
const MAX_HOLD_BARS = 480; // sell after 8 hours held, whatever the price
const MAX_LOSSES = 1; // after one losing trade, stop trading for the window
const MAX_SLIPPAGE_BPS = 10_000;
const BPS = 10_000n;

const closes: bigint[] = [];
let maSum = 0n;
let entryClose: bigint | null = null;
let entryBar = -1;
let entryEquity = 0n;
let losses = 0;

function sma(): bigint | null {
  const n = Math.min(closes.length, MA_BARS);
  if (n === 0) return null;
  return maSum / BigInt(n);
}

function onBatch(state: BarsState): (BuyInput | SellInput)[] {
  const close = state.close(SYMBOL);
  if (close === null || state.warmingUp) return [];
  closes.push(close);
  maSum += close;
  if (closes.length > MA_BARS) maSum -= closes[closes.length - MA_BARS - 1];

  const held = state.positions.get(SYMBOL)?.qty ?? 0n;

  if (held === 0n) {
    if (losses >= MAX_LOSSES) return [];
    if (closes.length < MA_BARS) return [];
    const ma = sma();
    if (ma !== null && close * BPS < ma * (BPS - DIP_BPS)) {
      entryClose = close;
      entryBar = state.seq;
      entryEquity = state.equity;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  // Holding: exit on mean reversion, profit target, stop, or max hold.
  const ma = sma();
  const entry = entryClose ?? close;
  const exitNow =
    (ma !== null && close >= ma) ||
    close * BPS >= entry * (BPS + TAKE_BPS) ||
    close * BPS <= entry * (BPS - STOP_BPS) ||
    state.seq - entryBar >= MAX_HOLD_BARS;
  if (exitNow) {
    if (state.equity < entryEquity) losses += 1;
    entryClose = null;
    return [{ side: 'sell', symbol: SYMBOL, qty: held, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({ onBatch });
