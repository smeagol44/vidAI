# Nutrient-intake selection v1 — registered protocol (#87)

Base: draft #86, 211025a3f9d5144b3fafa8679ee882c426cee64a.
Branch: experiment/nutrient-intake-87, stacked on experiment/neural-modes-food-63.
This is offline artificial selection, never a live-ecosystem score.

## Fixed design before candidate evaluation

- Two architectures: original six-output legacy, and neural-motor-v1 two-output
  Mode/shared Command hybrid (.06 hysteresis). No genetic selector/extra head.
- Fresh entire networks, paired brain seed17, same trunk/recurrent initialization
  from #85/#86. Legacy2172 versus hybrid1972 scalar parameters; output rows have
  architecture-specific streams/semantics. No trained Darter weights retained.
- Unchanged CUR-001 Darter anatomy, senses, mouth, CPG traits, capacity, learning,
  v3 physics, capsule-v1 mouth and ordinary nutrient properties.
- 15 generations x15 offspring x12 seconds per architecture:450 offspring total,
  plus2 initial founders. Each generation descends from its frozen start parent.
  Eight random neural scalar events with replacement, Gaussian sigma.15, existing
  bounds/mutation implementation; no architecture-selector mutations.
- Sole score: actual nutrient energy ABSORBED (J), summed from ordinary post-tick
  mouth intake, cross-checked against food loss/assimilation/reserve/heat closure.
  Validity is a gate, never a secondary score. Strict greater-than replacement;
  ties retain parent, including all-zero intake. No neutral drift or retuning.
- Full world reset before every trial. 1000x800px, root at500,400 heading.37,
  seed73, gravity0, viscosity.18. 240 ordinary3000J nutrients: normal abiotic
  blooms recipe (65% cluster probability,12 grid sites,96px spread at this size,
 35% uniform);300 nutrients/million px². No placement relative to brain/action,
  no filtering/rejection of initial contacts, no repositioning after results.
  No inflow/respawn during12s. Normal initial Darter reserve from world creation;
  fully accounted external initial stock, no repeated subsidy.
- Normal metabolism, learning, chemical payment, finite reserves and physical
  limits remain. Only offline mortality marking (starvation/senescence) is
  suppressed for this singleton herbivore evaluation, with would-be events
  recorded. No energy/age/velocity/state resurrection. Production/default ticks
  and save schemas cannot enable protection. Normal reproduction remains intact
  (Darter maturity18s exceeds12s); any unexpected eggs invalidate a candidate.
- Predeclared physical gates inherited from previous studies: finite singleton,
  full duration; no boundary-zone interaction, angular/linear guards; substep
  anchor<.5px, joint-limit excess<.05rad, constraint batch gain<1e-12J,
  post-constraint/contact omega<=20.001rad/s; chemical closure<1e-5J and prepaid
  work residual<1e-9J. Correct insufficient-energy scaling and zero reserve are
  VALID resource outcomes, not a reason to manufacture energy or reject intake.
  Delivery is tested against the paid scale, not unscaled demand.
- Record all450 mutation ledgers, reconstructable genotypes, full per-generation
  selected genomes, intake best/median/fed count, validity, contacts/detections,
  movement/joint trajectories, work/metabolic expenditure, modes and learned
  somatic offsets. Genomes never inherit learned offsets/activation state.
- Three held-out arrangements seed811/977/2301, headings-.7/2.3/pi/2, same12s
  and habitat recipe. Evaluate initial and final specimens separately (12 trials);
  no held-out result influences training. Preserve champions/failure slots.
- Separate verification: ordinary physical mouth contact/depletion/assimilation;
  zero-reserve and senescence protection without energy creation; protection-off
  mortality; observed/unobserved equality, exact Worker/host and reset/fork;
  frozen old final-state compatibility. No broad evolutionary/physics reruns.
- Append-only uniquely named generation archives and final manifest with hashes;
  never overwrite #85/#86 evidence. A few exact replay checks may validate the
  preserved specimens, explicitly outside450 training proposals.

## Interpretation / stopping point

Report actual improvement, invalid/fed counts, mode/learning effects, performance
and held-out reliability, including zero-progress outcomes. One run/architecture
cannot establish superiority. No further search, coefficient/gain/starter tuning,
#78 changes, merge, promotion, deployment, Wiki or VIDA3D modification.
Stop after evidence, focused checks and #87/#57 checkpoint for owner review.
