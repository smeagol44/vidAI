# Versioned nutrient recycling — issue #125

## Scope and mechanism

Contributor fork main candidate, based on c6306a3. New closed application worlds
select nutrientCycle decay-v1, snapshot schema 18. Historical omitted regimes
retain exact geometry, lifecycle and PRNG ordering. No genetics, controllers,
physical feeding rates, digestion, incubation, reproduction or body physics change.

Every food particle dissipates up to 30 J/s to the signed reserve. At 60 seconds,
carrion turns only its remaining energy into nearby ordinary plant fragments
of at most 3000 J, limited by targetNutrients, nutrientLimit and total food slots.
Overflow returns once to reserve. Fragmentation never draws energy from reserve.
Ordinary reserve-funded recycling and Default/Harsh generation rules are unchanged.

## Registered bounded comparison

Protocol registered upstream in #125 before implementation: seeds 17/73, one
60-second pair each, unchanged nine featured showcase founders and default closed
conditions, historical cycle versus decay-v1. Exactly matching initial full-state
SHA256s are recorded for each pair. No selection, tuning or replacement runs.
Four additional extinct Default/Harsh controls each run 120 seconds. Nine frozen
food-free five-second paired full-state equality controls isolate physical motion.

The original eight ecological conditions completed and printed all receipts.
A subsequent food-free fixture removed already-funded organisms without adjusting
the pool and was rejected by snapshot conservation before any food-free tick.
Original stdout/error is retained in nutrient-cycle-v1-original.log. Only the
food-free fixture setup was corrected, then its first execution completed using
--food-free-only. No ecological condition was rerun or replaced. JSON retains all
original measured rows and labels this execution history.

## Ecological observations (historical → decay-v1)

| Seed | Living at 60 s | Plant absorption J | Prey absorption J | Plant particles | Food stock J | Reserve J |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | 10 → 10 | 55752 → 53167.2 | 48 → 6816 | 270 → 481 | 785310 → 789256 | 715.82 → 1382.43 |
| 73 | 11 → 10 | 76488 → 56704.4 | 0 → 0 | 269 → 479 | 765390 → 782265 | 735.31 → 3664.28 |

Seed 73 plant absorption falls 25.9%; one fewer hatch/living animal occurs, with
no completed deaths in either pair. Seed 17 plant absorption falls 4.6% while
actual prey intake rises. Both new worlds have zero eggs at the final tick,
versus one in each historical world. These are material changes in short,
trajectory-dependent observations, not improved ecology or reliable predation.
Food count rises because smaller particles release energy that can fund ordinary
3000 J generation; closed Unlimited already ignores the initial target for that
ordinary generation. Budget remains 972000 J in every showcase condition.
Maximum absolute stock discrepancy is below 1.6e-8 J.

All nine food-free pairs preserve exactly equal complete states, isolating the
change from locomotion equations. No established physics/ecology reference file
was refreshed. Existing historical baseline tests remain required.

Extinct Default at 120 s: historical 275 plants/825000 J food/no reserve/no new
particles; decay-v1 508 plants/821197.5 J food/3802.5 J reserve and 568 newly generated
particles. Extinct Harsh: both generate exactly 120 particles at the existing
1/s rate; historical retains 120/360000 J food, new retains 100/151450 J food and
banks 673550 J. Both keep the same 825000 J budget. No new organisms appear.

Single sequential kernel+observation samples: seed 17 4431 → 4280 ms, seed 73
4109 → 4289 ms. These uncontrolled samples do not establish a speedup, regression
threshold or browser FPS claim. No repeated timing campaign was run.

## Validation and limitations

Local npm ci succeeds (113 packages). Fast suite: 374 passing including 14 new
acceptance tests; build/typecheck and actual production Worker pass. Worker checks
cover schema-18 tank/tube reset, exact 5x direct continuation including PRNG and
mineralization, paused restore and cycle-switch rejection. Focused browser checks
exercise startup opt-in, sub-minimum physical rendering, x0 import/export,
mineralization, restoration and historical minimum-radius rendering in both hosts.
Local browser download failed with a truncated archive; remote CI supplies the
Chromium/Firefox evidence. Final CI/publication receipts belong in #125 and the
internal PR, not an inferred completion claim here.

Historical worlds never gain the cycle on import or budget/physics conversion.
A fresh reset enables it; no in-place ecology upgrade is included. Canonical
upstream acceptance and a separate upstream PR remain outside this authorization.
