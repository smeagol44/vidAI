# VIDA 2D — Development Priorities

The [current Wiki](https://github.com/smeagol44/vidAI/wiki) describes shipped
features and the original phase status. [Project status](PROJECT_STATUS.md)
records experiments and release history. This file tracks remaining work;
listed extensions are not implementation promises.

## Current position

Original Phases 1–4 have their core implementation: variable neural architecture,
inherited topology mutations, egg/trait trade-offs and activation-memory
timescales. Phase 5's bounded waking-learning feature set is implemented;
robust learned ecological benefit is unresolved. Phase 6 sleep/rest and replay
is optional and unimplemented.

The separate B-A–B-D movement/behavior/measurement workstream is complete as a
bounded prototype. Nine featured starters coexist with 55 legacy designs.
Three featured gaits use selected offline-evolved motor alleles; Twin Oar has
reviewed mouth-first paddle timing and a stronger mutable retinal prior. Worker/render
separation and the spatial/neural/contact/lineage optimizations are deployed.
These capabilities do not establish sustainable ecology or the original
roughly 100-creature/1,000-part performance ambition.

## Next ecological goal

Close the loop through **unassisted food acquisition → enough net energy →
funded laying → successful hatching → viable offspring across generations**.

1. Use the existing acquisition census on representative current starters to distinguish absent/undetected edible stimuli, inadequate approach, mouth-access failures and insufficient net energy.
2. Correct specific demonstrated control, geometry or cost problems. Preserve mutable behavior and avoid prolonged manual brain tuning, hidden targeting, automatic survival aid or a mandatory diet quota.
3. Make naturally earned reproduction repeatable across seeds for a representative grazer, then extend to omnivores and predators. Pre-funded adults and deliberately placed test food remain controlled mechanisms, not proof of ecosystem viability.
4. Evaluate selection and retained-versus-erased learning after the food/reproduction loop works. A short survivor count or a larger brain alone is not an ecological success criterion.

Use bounded, causal comparisons. Extinction remains a legitimate outcome;
no guarantee that every genotype or seed survives is intended.

## Foundations and corrections

| Work | Current gap |
| --- | --- |
| Mechanical-work accounting | Pre-update joint speed and a legacy per-tick cost cap are approximations. Chemical ledger closure is not full mechanical-energy verification. |
| Drag and muscle scaling | Calibrated axial/transverse drag and inertia-based torque differ from the literal uniform face-drag/geometric muscle model. Any revision needs explicit versioning, evaluation and save-continuation handling. |
| Contact fidelity | Discrete collision substeps, flexible directly hinged-neighbor intersections, and simplified food/egg response remain. |
| Remaining trait trade-offs | Review unused or weakly connected inherited traits, including `reproductionThreshold`, without assuming every change is beneficial. |
| Scale | Current anatomy is capped at seven parts; larger worlds/brains and any increased part limit need measured throughput and correct continuation. |

## Larger future systems

- Physical body growth, local tissue injury/repair and gradual senescence; current lifecycle labels do not implement these.
- Modular body-associated controllers and coordinated body/control duplication; within-life structural brain development remains absent.
- Optional rest/sleep and bounded experience replay after useful waking behavior: real vulnerability/costs, no replayed calories, and equal-compute comparisons. Predictive world-model dreaming is a further optional extension.
- Optional currents, chemical sensing/signaling and creature-generated acoustic communication. Abiotic nutrient Blooms already exist; display music/SFX are not creature communication.
- Named experiment archives, longer event history, rewind/replay and cross-seed comparisons. Current world forking clones/replaces the active state; it is not a multi-world archive.
- Optional deformable bells or fluid jets, requiring new physics rather than a setting on rigid hinged jellyfish.

## Smaller additions

Bank favorites/sorting, named environment profiles, CSV statistics export and
population anatomy/neural summaries remain available future improvements.
Existing Bank filters, world snapshots and inherited-versus-learned connection
inspection already work.

Continue in bounded branches/PRs with appropriate automated checks. Keep the
actual Wiki current in place; retain historical measurements in project status.
Avoid treating a mechanism's implementation as proof of useful behavior.
