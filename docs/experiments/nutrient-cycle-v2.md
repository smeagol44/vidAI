# Slower food cycle and minimum radius — #125 follow-up

New application worlds select decay-v2/schema19: plant/carrion loss is 1 J/s,
minimum physical/visual radius is6 world units and untouched3000 J food lasts
3000 simulated seconds (50 minutes). Historical decay-v1/schema18 retains its
exact30 J/s arithmetic and unbounded shrinking. Older absent cycles are unchanged.
Explicit Settings upgrade takes an authoritative snapshot, preserves energy,
PRNG and organisms, changes the regime and recomputes food radii; import never
silently migrates. Feeding, genetics, physics, eggs and the60s mineralization
algorithm are unchanged. New particle geometry is shared by vision and feeding.

## Registered comparison

#125 registered one new60s pair per seed17/73 from fork main4fb0b0f, nine unchanged
featured founders, decay-v1 versusv2. Every pair has identical initial full-state
SHA256. Each condition ran once; JSONL receipts are flushed after each completion,
and the runner refuses to overwrite existing evidence. Existing v1 reports remain
unchanged. The v1 baseline reproduces prior observed metrics exactly; these are
comparison controls, not new evolutionary search or selection.

| Seed | Cycle | Living | Eggs | Plant intake J | Prey intake J | Food particles | Food stock J |
| --- | --- | --- | --- | --- | --- | --- | --- |
|17|v1/30 J/s|10|0|53167.2|6816|481|789256|
|17|v2/1 J/s|10|0|52531.27|9480|279|790745|
|73|v1/30 J/s|10|0|56704.4|0|479|782265|
|73|v2/1 J/s|10|0|70315.63|336|280|771458|

Seed17 plant absorption falls1.2% and prey absorption rises39.1%; seed73 plant
absorption rises24.0% and actual prey intake becomes336 J. Both remain10 living,
zero eggs and zero completed deaths. Initial/final budget is972000 J; maximum
absolute stock discrepancy is1.37e-7 J. Lower turnover leaves fewer, longer-lived
particles. Material feeding changes were disclosed before integration. These two
short trajectories do not establish ecological superiority, reliable predation
or sustainable multigeneration populations.

Single sequential kernel+observation samples: seed17 5825→4751 ms, seed73
4561→4141 ms. Timing is uncontrolled and not a browser FPS/speedup claim.
Original measurements are in nutrient-cycle-v2.json/.jsonl.

## Acceptance

379 local fast tests include original v1/legacy expectations plus1 J/s depletion,
6-unit floor,60s remaining-energy conversion, strict schema19/tube restoration
and UI-only observer preference persistence. Build and real production Worker
pass with exact direct continuation for both cycle versions in tank/tube worlds,
paused reset and control-switch rejection. Browser gates cover current startup,
old imports, explicit upgrade, actual painted radius6, and independent configurable
selection/tracking in Worker/fallback with scenario defaults and narrow-window fit.
Final remote CI/publication receipts are recorded in #125/#126 and the fork PR.
No upstream submission is authorized.
