# Preregistered #103: graded moving nutrient and inherited mutation targeting

Owner request: `proximity-targeting-v1-owner-request.md` (verbatim). Exact base: #101 `a44515e27cc82294fcb55cbadf523351e545b09d`; #99 and #101 remain immutable. Branch `experiment/proximity-targeting-103`; base PR branch `experiment/moving-nutrient-pursuit-100`.

## Frozen budget and selection

Legacy six-output seed17 original fixed learning; MUTABLE two-output seeds17/71/1901/4099 with exact original inherited learning traits/masks/extra nine draws. ONLY71/4099 use custom targeting; assignment fixed before results. Five independently initialized founders; each10 generations of10 offspring for15s; all500 offspring,5 founders,15 final held-outs. No extra scientific trials,neutral drift,tiebreaker or threshold exclusion. Freeze parent for each generation; select strictly higher actual absorbed J; ties retain incumbent. All historical physical diagnostics are read-only. Held-outs811/-.7,977/2.3,2301/pi/2 are15s and never affect selection.

## Change1: isolated experimental feeding

New explicit `experimentalFeedingMode='proximity-90-v1'`,save schema103.0.0; requires original `uncapped-pursuit-v1`,capsule mouth,v3 and original pursuit state. No UI activation or silent upgrade. Old schemas and contact-only feeding remain exact.

At the original post-physics feeding tick, calculate true capsule-to-nutrient-surface gap d=max(0,segment distance-mouth radius-nutrient radius). Strength=max(0,min(1,1-d/90)). Limit original gross mouth allowance by this strength,available finite stock and ordinary storage capacity. At physical contact d=0 use that single transfer,never another proximity transfer. Original80% assimilation,rejected heat,budget and real feeding receipts remain. Replenish gross extraction with explicit external ledger input; keep3000J/radius18. `mouth:contact` uses genuine geometry only; intake uses original actual absorbed/ordinary allowance normalization; body feeding and proportional learning teaching use received energy only. Record per-mouth tick gap,strength,gross/absorbed J,contact,state; split contact versus noncontact J and moving/paused/frozen J. Record zero-transfer samples too. No proximity-only reward.

## Change2: parent birth-coordinate targeting

Metadata outside genome/somatic state identifies each actual neural scalar by matrix and stable hidden/input/output IDs (biases likewise). Store eight ordered receipts with before/after,repeated coordinates,original genetic parent identity and net changed-coordinate set relative to that genetic parent. A coordinate whose final value equals its original value is absent from the target set; no-op/clipped events remain in receipts. Reject incompatible/malformed origin metadata; de-duplicate its coordinate set. Empty valid net set uses unrestricted random mutation and reports0 targeted.

The founder has null origin; all its children use exact original unrestricted random mutation even in later generations. If a mutated child is selected,its own birth record becomes the selected origin; retain it until replacement. Never union ancestry or somatic changes.

Exactly eight ordinary Gaussian sigma.15 events,bias bound1.5/weight bound3.5. Separate target PRNG `Xoshiro(mutationSeed xor 0x66a103ed)` supplies rounding,uniform without-replacement parental choice and event-position shuffle. Five requested targets if first uniform<.72,six otherwise; expected5.28/8. Use min(requested,eligible distinct) targets,each at most once; fill other events uniformly from all coordinates outside the parent set,with replacement. All parental coordinates remain reachable next lineage as sets change. Original neural stream still consumes original coordinate uniform and two Box-Muller uniforms per event in original order; targeted events discard the coordinate uniform,random events map it uniformly onto the outside pool. Thus Gaussian values,draw count and subsequent streams are preserved. Original plasticMutation's separate nine draws/trait/mask logic is used unchanged. Record requested/realized targets,exploratory events,rounding draw and all target-choice draws/decisions. For founder fallback,original eight receipts are byte-exact.

## Everything else unchanged

Exact #101 CUR-001,eye/mouth/anatomy,neural architecture,finite10kJ reserve,4800x3000,root2400/1500 heading.37,env73,viscosity.18,gravity0,passive-work-v3,normal mortality/metabolism,motor strength/prepayment,joints/contacts/drag. One ordinary source120px ahead of forward mounted eye. Same10 presampled1.5s intervals,25%STOP,outward half-plane22px/s,pause-on-inward and permanent swept405px union-of-eye-disks exit. Environment seed derivation/240Hz motion unchanged. No400px/s or20rad/s cap;no replacement cap or diagnostic selection gate.

## Preflight, persistence and audit

Before any founder/training evaluation: focused geometry,energy,senses/real learning,mutation origin/rounding/duplicates/empty/budget/fresh state/standard exactness tests; fast suite/build/production and focused actual Worker checks including deterministic replay/snapshot/reset. Fixtures are verification only,not additional evolution. Freeze scientific source hashes,Worker asset,initial genomes,sources,prior data hashes. Preregister before training and retain before-unit durable intent. Save requests before execution and immutable packets atomically/fsync/readback; unknown requested-but-missing packet halts,never silently rerun. Publish recoverable full-unit ZIPs+part/member/ZIP hashes+leased-ref/fresh Git readback after each founder/generation,then advance. All520 requests/packets and50 choices independently audited. Five final specimen Worker packet replays and split/reset forks are explicitly verification,never scientific replacement trials.

## Deliver and stop

CSV/JSON five generation0–10 curves;founder/final/held-out real intake,contact/proximity and source-state split;all500 coordinate-event statistics and selected ancestry reuse/learning genes;complete all520 creature/source240Hz traces plus final/selected graph exports;actual learning/costs,motor torque/modes,total/late path/net movement,energy/numerical diagnostics. Distinguish stationary proximity feeding from locomotion/pursuit/contact. Descriptive #101 comparison explicitly changes feeding rule;seed and algorithm confounded,not matched pairs or causal targeting evidence. Update #103,#57,draft PR;STOP owner review. No merge,deployment,Wiki,release,production/testing,extra experiment orVIDA3D work.
