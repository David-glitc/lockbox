# Lockbox

Lock tokens, BDEX V2 LP tokens and BDEX V3 positions on BOT Chain until a date, with a public page for every lock.

## The gap it fills
BOT Chain's launchers (Equifold, RAISE, the wave 3 Launchdesk) lock liquidity inside their own flow, but a team that launched a token any other way has no neutral place to prove its liquidity or team tokens are locked: nothing on BOTScan turns "trust me" into a link. Lockbox is that place. It is the BOT Chain equivalent of a locker like Unicrypt or Team Finance, built for the two things BDEX has: V2 pairs (the LP token is an ERC-20) and V3 positions (the LP is an NFT from the "B DEX Positions NFT-V1" manager, `0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090`).

## Contract surface (`src/Lockbox.sol`, 8.8 KB)
| Function | Notes |
|---|---|
| `lockToken(token, amount, unlockAt, label)` payable | ERC-20 or V2 LP token. Credits what arrived, so fee-on-transfer tokens cannot over-credit. |
| `lockPosition(manager, tokenId, unlockAt, label)` payable | Takes custody of a V3 position NFT. |
| `extend(id, newUnlockAt)` | Later dates only. |
| `topUp(id, amount)` | Add tokens to a token lock. |
| `withdraw(id, amount)` / `withdrawPosition(id)` | Only after `unlockAt`, only the lock owner. |
| `collect(id)` | Lock owner collects a position's trading fees any time. Liquidity stays locked: Lockbox never calls `decreaseLiquidity`. |
| `transferLock(id, to)` | Hand the lock to another address (selling a locked position). |
| views | `getLock`, `idsByToken`, `idsByOwner`, `latest(offset, limit)`, `lockedAmount`, `lockedShareBps` |

No owner, no pause, no upgrade, no admin path to locked funds. Maximum lock is 100 years.

## Fee model
A flat `fee` in BOT per new lock, paid at once to an immutable `feeRecipient`, both set at deploy (proposed: 0.05 BOT, about $0.60). Withdrawals, extensions, top-ups and fee collection are free.

*Assumed:* a flat BOT fee rather than a percentage of the locked amount, because a percentage penalises the projects that lock the most and BOT is the only asset every user holds. A zero fee is also valid.

## The app (Next.js 15 static export)
`/` create a lock and see the latest ones · `/lock/?id=N` the public lock page (status, countdown, owner actions) · `/token/?address=0x…` every lock for a token and the share of supply locked · `/me/` your locks. No backend: it reads Lockbox with viem. Configure with `NEXT_PUBLIC_LOCKBOX`, `NEXT_PUBLIC_RPC`, `NEXT_PUBLIC_CHAIN_ID` at build time; the output is `site/`.

## Run it
```bash
forge test                                          # 10 unit/fuzz tests + 2 fork tests (the fork tests no-op without FOUNDRY_FORK)
FOUNDRY_FORK=true forge test --match-test fork      # real BDEX: a V2 LP token and a freshly minted V3 position (fees collected while locked)
npm install && npm run test:web                     # anvil fork + deploy + next build + headless Chromium: lock, lock page, token page, time-travel, withdraw
NEXT_PUBLIC_LOCKBOX=0x… npm run build              # static site in site/
```
