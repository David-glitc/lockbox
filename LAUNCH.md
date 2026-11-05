# Lockbox: launch steps (needs the user's approval; nothing here has been run on mainnet)

1. Choose the fee and recipient (proposed 0.05 BOT to the deployer wallet).
2. Deploy: `forge create src/Lockbox.sol:Lockbox --rpc-url https://rpc.botchain.ai --private-key $KEY --broadcast --constructor-args 50000000000000000 <feeRecipient>`
3. Build and host: `NEXT_PUBLIC_LOCKBOX=0x<deployed> npm run build`, then upload `site/` to any static host (the user chooses).
4. Smoke test: lock a small amount of WBOT for one day on the live site, open its lock page, and check it on BOTScan.

## Estimated gas (forge gas report, 20 gwei)
| Action | Gas | Cost |
|---|---|---|
| Deploy | ~1.91 M | ~0.038 BOT |
| `lockToken` | ~340 k (+ ~46 k approve) | ~0.007 BOT + fee |
| `lockPosition` | ~335 k (+ ~50 k approve) | ~0.007 BOT + fee |
| `withdraw` / `withdrawPosition` | ~36–50 k | ~0.001 BOT |
| `collect` | ~72–113 k | ~0.002 BOT |
Launch total with one smoke test: about 0.06 BOT.

## Decisions for the user
- Fee amount and recipient (immutable after deploy).
- Whether to also list Equifold/Launchdesk locks on the board (not built; would need their event ABIs).
