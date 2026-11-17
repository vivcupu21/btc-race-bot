[![make.fun](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/vivcupu21/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/vivcupu21/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)

# Dip-hunter: a cbBTC mean-reversion bot

Entry for [make.fun's "Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261117-0603) (btc-race-24h-20261117-0603). The bot trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, with $1,000 of paper money. Long only, no leverage, no shorts.

## Strategy

Buy the dip, sell the recovery, and stop trading after one losing trade:

- **Buy** the full cash balance when the close falls 1.0% below its 240-minute (4-hour) simple moving average.
- **Sell** everything when the close recovers to the moving average, or rises 1.2% above the entry close, or after 480 minutes held, or falls 0.8% below the entry close.
- **Circuit breaker:** after one losing trade, the bot stops trading for the rest of the window. In a falling market the dips keep dipping, and the cheapest trade is the one never taken.

Everything is deterministic: no clock, no environment, no randomness. Two runs on the same bars produce byte-identical orders. Python 3.13, standard library only; the `vendor/` copy of the kit's `makefun_bars.py` shim owns the wire protocol (`agent-fun/bars-replay/v1`).

## Backtest (dev window, 24h, 16 Nov 2026)

Measured with an exact integer replay of the harness fill model (4 bps fee, 2 bps slippage, constant-product impact against each bar's pool depth, fills at the next bar's open), validated to the micro-dollar against the kit's own grader on buy-and-hold (+$1.067) and momentum (+$2.446). Then verified with the kit's official grader (`grade-local --driver process`, 17 Nov 2026): **net PnL +$1.580338, 2 trades, win rate 1.0, max drawdown 0.72%, fees $0.80, guardrails met, L1 regrade reproduced byte for byte** — the dev gate (net PnL > 0) is passed:

| bot | dev net PnL | trades | max drawdown |
| --- | --- | --- | --- |
| dip-hunter (this bot) | **+$1.58** | 2 | 0.72% |
| buy-and-hold (house) | +$1.07 | 1 | 2.12% |
| momentum (house) | +$2.45 | 1 | 2.12% |
| EMA-cross 8/21 (house) | -$106.22 | 68 | 10.96% |
| RSI-Bollinger (house) | -$24.25 | 11 | 2.79% |
| ADX-momentum (house) | -$32.66 | 26 | 3.60% |

Across eight other 24h BTC windows (8–15 Nov 2026, mostly down days, Coinbase BTC-USD 1-minute bars as a proxy), the bot's median net PnL was **-$1.21** — it mostly sits flat when there is nothing to harvest, instead of bleeding like the trend bots (median -$15 to -$190). The dev window is flat and choppy; trend systems whipsawed themselves to death on it, which is why this bot trades rarely and only at wide bands.

## Run it locally

```bash
node /path/to/kit/cli/makefun.mjs grade-local --kit /path/to/kit --bot . --driver process
```

The kit is the make.fun bundle for btc-race-24h-20261117-0603.

## License

MIT — see [LICENSE](LICENSE).
