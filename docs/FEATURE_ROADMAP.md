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

## Foundation status and swimming recovery

v0.34.1 restores established drag, muscle strength and simultaneous actuation
for new worlds, retaining prepaid positive work, reserve-limited actuation and
retirement of the unused reproduction-threshold promise. Schema v12 preserves
all three stored regimes. Existing surface-model worlds can explicitly repair
swimming while keeping their ecosystem. Starter/body/brain/diet tuning stays frozen.

The four-face/geometric-muscle replacement is **not closed**: its absolute
normalization destroyed movement. A future replacement needs demonstrated
physical validity and functional movement, with material positive/negative
changes disclosed before production. Formula tests alone cannot approve release.

## Closed world energy budget — planned foundation

Before ecological/starter tuning, replace the open nutrient replenishment model
with the user's finite, recycled energy budget. This is planned work, not shipped
behavior. Conservation here means the first law applied to VIDA's tracked
ecological stores; recycling expenditure into food is the intended game rule.

The stock invariant is **living biomass + living reserves + nutrients + carrion
+ funded eggs + signed world reserve = configured world energy**. Bodies have
anatomy-dependent construction value; food retains its actual remaining value
after bites. Current cumulative heat/loss counters are diagnostics, not extra
current stores. Crediting expenditure to the world reserve must not count the
same joules again through those counters. Solver mechanical-energy correctness
remains a separate, open foundation.

- Replace the nutrient target with a **maximum simultaneous plant-nutrient
  count**, default unlimited, and **total world energy**. A nutrient cap only
  gates new creation: lowering it does not delete food, and blocked energy stays
  in the world reserve. Unlimited slots never authorize unfunded spawning.
- A new ordinary nutrient costs its full particle value from the reserve
  (currently 3,000 J). Only create one when funded and a slot is available.
  Replace unconditional external inflow with funded conversion; specify its
  throughput separately because recycling speed also affects food availability.
- Food assimilation transfers value to animal reserves; unassimilated energy,
  metabolism, learning and movement expenditure return to the world reserve.
  Parent-to-egg funding, hatching, predation, death and carrion decay transfer
  their complete remaining value exactly once. Preserve current biological
  costs, efficiencies and frozen starter/body/brain/diet settings.
- A manual budget change by delta changes the world reserve by the same delta.
  Raising it immediately funds the reserve. Lowering it may produce a negative
  reserve: **withdrawal debt**, not negative physical energy. Stop nutrient
  creation until repaid; returning expenditure and decaying carrion pay it.
  Preserve every surplus joule when a transfer crosses zero. For example,
  -2,000 J reserve plus 5,000 J decaying carrion leaves 3,000 J available for one
  funded nutrient. Display the budget, embodied energy and reserve/debt clearly.
- Audit initialization, manual feeding, adding life, clearing food, failed eggs
  and all capacity/overflow/removal paths. Fund them from the same pool or make
  an explicit manual budget adjustment. Reaching a cap must never silently
  discard energy. Currently the plant target makes carrion wait; the separate
  hard particle limit and recorded sinks are distinct problems to replace.
- Persist an independent ecology regime and the live reserve/budget. Preserve
  exact continuation of existing open-economy saves; conversion must be explicit
  and funded from current stores, never cumulative historical heat/loss credits.
  Leave the saved physics regime independent. Encode unlimited settings safely
  in JSON rather than persisting numeric Infinity.
- Evaluate optional unlimited creature counts against measured CPU/memory
  limits. A finite budget can constrain population through funded body costs,
  but Worker/render separation does not make simulation capacity unlimited.
  Review particle, egg, population and save limits together; any computational
  safeguard must be visible and retain energy rather than silently killing life.

Implement in bounded PRs: persisted pool/transfers and migration first, funded
controls/conversion next, then capacity and multi-generation evaluation. Require
transfer and deficit/zero-crossing conservation checks, blocked-spawn/overflow
checks, exact save continuation and Worker/direct equivalence, plus build and
production Worker verification for runtime changes. Compare frozen movement,
costs, food availability and ecological outcomes before release; disclose any
drastic positive or negative effect before production. Do not claim sustained
ecology from ledger closure. Update the actual Wiki as each feature ships,
preserving its diagrams; keep unimplemented details in this roadmap.

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
| Solver mechanical energy | Actuator work is prepaid and acceleration-aware in paid-work worlds. Constraint bias/projection, contact and joint-limit energy remain unproven; chemical closure does not bound their error. |
| Fluid and tissue fidelity | The default retains calibrated anisotropic drag and inertia-scaled strength. A coherent surface/geometric replacement with justified absolute normalization and useful motion remains open; the surface mode is preserved only for stored-world continuation. |
| Closed ecological energy budget | Planned finite budget and reusable world reserve replace external nutrient replenishment; fully funded transfers, deficit repayment, controls, capacity paths and explicit save migration remain unimplemented. |
| Contact fidelity | Discrete collision substeps, flexible directly hinged-neighbor intersections, and simplified food/egg response remain. |
| Remaining trait trade-offs | `reproductionThreshold` is explicitly retired; child/parent funding remains unchanged. A broad audit/redesign of other biological trade-offs is outside this correction. |
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
