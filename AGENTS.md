# Working on VIDA

- This is the 2D simulation. Keep the current visual style, movable windows,
  camera controls, effects, and audio unless a requested change concerns them.
- `simulation.ts` is the production kernel. Founders retain 24 recurrent
  hidden neurons and six outputs per joint; brain v7 supports identity-stable
  1–96 hidden neurons, at most 65,536 enabled connections, and explicit disabled
  synapse keys. Preserve existing dense weights, hidden activations, founder
  steering and stable eye/part/mouth/motor channels by ID. Brain v4 added
  aggregate feeding and normalized COM depth; do not duplicate reserve input.
  Migrate old four-channel motor commands by key, never array stride. Save
  schema v11 imports v3–v10 and preserves exact current continuation. Brain
  v7 supports rare inherited structural mutation (neurons and connection masks)
  and per-neuron inherited leaky activation memory (tau 0–4 seconds). Tau=0
  follows the exact original recurrence; every founder and earlier save
  migrates to tau=0. Offspring start with zero neural activations.
  Original Phase 5 waking learning is now implemented as a bounded
  feature set. Actual retained-vs-erased experience comparisons
  physically improved later food intake in one short offset
  (+180 gross J), worsened another (-420 gross J), and tied
  two. Reliable foraging or survival is NOT demonstrated. Legacy dense-24 controllers retain their exact baseline
  neural upkeep through reference-normalized enabled-synapse cost.
- Original Phase 5, v0.21 first waking plasticity increment:
  optional heritable `plasticityRate` and `forgettingRate` permit
  reward-modulated somatic offsets ONLY on existing enabled Angle motor
  edges (max 96). Eligibility decays over 0.6 s; reinforcement comes
  solely from true previous-tick mouth absorption, never target
  coordinates, feeding counters, debug labels or oracle. Enabled
  candidate upkeep is 0.002 J/s/edge, rewriting is 0.4 J per absolute
  weight unit; both leave creature reserves into metabolic heat, and
  mutations cannot create energy. Each live animal maintains its own
  learnedMotorWeights (stable HO edge key, bounded delta/eligibility);
  offspring inherit only the genetic learning traits and original
  matrices, not the parent's acquired synapses or traces. Optional
  state is strictly validated and resumes exactly in schema v11,
  without changing brain v7. `BrainGraph.tsx` shows effective (genome
  plus acquired) motor weights separately. Founders and historical
  saves lacking alleles preserve exact behavior and PRNG.
  In the controlled real-mouth-reward test, force was disabled, so
  a measured increase in neural Angle response proves only somatic
  conditioned output change, NOT improved physical food collection.
  Original Phase 5 remains IN PROGRESS; next test same-genotype
  motor-active learning-versus-off physical benefit. Original Phase 6
  sleep/replay remains unimplemented. Keep tests fast in
  `tests/waking-plasticity.test.ts`; do not claim learned fitness.
- Original Phase 5 v0.22: two optional traits extend v0.21 waking
  plasticity. `plasticMotorScope: 'all'` selects eligible HO connections
  across all six outputs on every joint, interleaving outputs and
  respecting the same 96-edge ceiling; absent means EXACT original
  Angle-only selection. `injuryAversionRate` (0..1/s) subtracts
  the real previous-tick `body:injury` input from food-reward
  teaching, never nearby color/identity or ordinary energy loss.
  Both mutate/inherit genetically, whereas somatic learned weights
  do NOT pass to offspring. All edges remain enabled-only, finite,
  identity-keyed and paid for; keep save v11/brain v7 exact and
  reject invalid traits/learned edge identities. Do not force
  escape, targeting, neural biases or new motor thrust.
  Short physical tests suffice; don't start giant genotype
  calibration campaigns or claim learned survival advantages
  until demonstrated. The 3D repo is wholly unrelated.
- Original Phase 5 v0.23: independently inherited, mutable
  `sensoryPlasticityRate` enables up to 96 existing enabled RGB
  eye-input-to-hidden synapses to acquire individual deltas
  and trace eligibility. Only real previous-tick mouth intake
  and actual physical bite injury provide positive/negative
  teaching. Learning debits usable energy to metabolic heat
  for upkeep and rewrites, and alters the future recurrent
  neural evaluation. Save schema v11 strictly validates
  `learnedSensoryWeights` by canonical IH edge, bounded delta
  and trace, and preserves deterministic continuation.
  Old genomes lacking the trait use exact old math.
  Children inherit genes, never learned retinal synapses.
  The Brain inspector displays learned RGB and motor weights
  distinctly. Three short tests in `tests/sensory-association.test.ts`
  establish actual food learning, subsequent causal response,
  energy conservation and save/offspring safety. Do not claim
  learned generalization or long-term ecological fitness, and
  do not reopen extended brain/founder tuning campaigns.
- Original Phase 5 v0.24 selective waking consolidation:
  optional heritable `memoryConsolidationRate` (0–2/s)
  protects already acquired, sign-consistently
  reinforced learned motor/retinal synapses from
  forgetting (at most 95% reduction). Conflicting
  true reinforcement reverses consolidation faster;
  unreinforced memory naturally erodes. Personal
  per-edge `consolidation` is bounded 0..1, strictly
  validated and saved exactly in schema v11, never
  inherited by offspring. Its additional living
  cost of 0.004 J/s per fully consolidated edge
  debits usable energy to metabolic heat; no
  unearned refresh, scripted chase, category
  oracle, sleep or free movement. Absence of
  the allele must exactly preserve v0.23
  learning, old genomes and 55 founders.
  `tests/selective-memory.test.ts` has three bounded
  checks; four-second food-free replay retained
  0.5673 vs 0.3869 total acquired weight in a
  matched nonconsolidated counterfactual. This
  is **not demonstrated ecological survival**.
  Keep tests compact; Phase 5 still needs
  functional physical behavior validation, while
  Phase 6 dreaming/replay remains optional.
- Original Phase 5 v0.25 closure: physically swimming
  Darter learns from true finite patch intake, then
  matched exact post-training worlds keep or clear
  only acquired synapse state and physically seek
  another finite nutrient. Four bounded second-food
  setups yielded +180 J, -420 J and two ties,
  with 100-organism short combined plasticity smoke,
  energy accounting and all prior fast regressions.
  Waking learning is COMPLETE AS A BOUNDED FEATURE,
  not a robust adaptive forager, genotype-wide
  generalization or demonstrated population fitness.
  The 55 founders and schema v11 remain unchanged.
  Original Phase 6 is optional/unimplemented.
  Future work should prioritize novel meaningful
  features or ecological fitness, not unbounded
  retuning of these four scenarios.
- Phase 5B motor architecture: every joint's original six neural outputs
  remain stable. Optional inherited `oscillatorMix` (0–1) and four
  `waveHarmonics` coefficients (each −1..1) permit wave-free direct Angle
  actuation or smooth mixed periodic strokes; absent alleles must execute
  the *exact* old sine formula in older genomes and founders. `Amp` can
  silence an evolved oscillator without disabling physical muscle torque.
  All commands remain torque-limited, substep-integrated and paid from the
  conserved energy ledger. Optional motor alleles remain backward-compatible in current schema
  v11, with strict validation. Use short tests in `tests/evolvable-actuation.test.ts`.
- GitHub Wiki is the *current-feature reference*, not a historical changelog.
  Keep one succinct, maintainable page per currently reviewed feature with
  accurate schematics and limitations; update it in place.
  The repository's `docs/wiki/` is the canonical editable source, published
  to the actual GitHub Wiki by `.github/workflows/publish-wiki.yml` on main.
  Only sync maintained pages; preserve unrelated Wiki pages. Keep historical
  investigations in `docs/PROJECT_STATUS.md`, not Wiki pages.
- Phase 5C injury sensing: the seventh brain revision adds one
  identity-stable `body:injury` input, sourced ONLY from actual energy
  removed from a prey's reserves or tissue by physical carnivore/omnivore
  mouth contact. Accumulate real bite joules and sample next neural tick
  as clamp(joules/60, 0, 1), then clear. No predator identity, phantom
  proximity, forced panic or energy creation. New founders keep this
  channel disconnected; the old deterministic PRNG draws, retina and
  oral weights must remain unchanged. Imported v10 brain v6 and older
  snapshots remap neural inputs by key, add zero new weights/state and
  preserve everything else; schema v11 current is strict brain v7.
  Avoid claiming predator escape until physical comparative trials pass.
- Phase 5C physical escape innovation: `wire-injury-motor` is a rare,
  stochastic **brain topology mutation** on offspring, not a runtime escape
  reflex. It grows one isolated hidden neuron (within the 1–96/edge budget),
  connects `body:injury` to that neuron, and links the neuron to a randomly
  selected existing motor output channel across joints. Sensory and motor
  signs and gains vary independently, so mutations can help or harm.
  Zero injury leaves the new neuron silent. Normal neuronal upkeep and
  synapse accounting apply; the 55 founders remain unchanged. Paired
  2.5-second real-physics rear-mouth trials demonstrate a genotype with
  stronger Amp strokes taking 270–330 J versus 420–450 J with the same
  geometry and a disconnected stimulus. Those are *stationary* hunters;
  mobile hunting and ecological selection are unproven. Keep
  `tests/bite-escape-survey.test.ts` short, seeded and causal.
- Phase 5C mobile-predator measurement: paired, short trials in
  `tests/moving-hunter.test.ts` use self-propelled articulated hunters
  against identical injury-coupled/disconnected genomes, with real
  transfer accounting. Nine of 15 initial Darter encounters physically
  bit; the injury circuit reduced bite J in six, tied two and worsened
  one, while six noncontact trials cannot be called escapes.
  Across five body plans with 15 actual biting setups it improved five,
  worsened six and tied four. Thus a single motor policy is not a
  universal escape adaptation, and passive straight-line swimming is
  not active visual pursuit. The Brain inspector shows the real injury
  neural signal, next-tick queued bite energy, and enabled inherited
  input synapses without introducing a new simulation cue.
- B-C heritable lateral retinal steering: `wire-retinal-turn` adds an
  isolated hidden neuron receiving signed left/right ray contrast in one
  inherited color channel, projecting to existing joint Angle outputs.
  Both sensory and motor signs/magnitudes vary across offspring; the
  ordinary mutation operator can generate it. Real RGB/occlusion, neural
  persistence, bounded edges, torque, drag, energy costs, and exact saves
  remain authoritative. In 24 five-second trials versus disconnected
  counterparts with independently swimming prey, only four genetically
  sighted circuits physically bit *after* the prey travelled 30–90px;
  none improved closest COM separation. This is possible visual contact,
  NOT reliable pursuit, target identification or learned hunting. Keep
  `tests/moving-visual-hunter.test.ts` bounded. Proceed to B-D baseline
  rather than indefinite founder reweighting.
- B-C inherited eye spectra: each eye may optionally store `spectralSensitivity` as
  three validated 0–1 RGB gains; absent means [1,1,1] and must preserve
  legacy retina, costs, saves and founder reproduction baselines. Filter
  water-attenuated RGB, mask neural distance to 1 when *no* spectral response,
  and retain physical occlusion. Sensor upkeep is 5 × (0.25 + 0.75 ×
  mean gains) per eye, charged through the existing conserved sensory ledger.
  Offspring mutations can produce exact 0 and later regain sensitivity,
  without prey identity, free movements or new brain inputs. Use
  `tests/spectral-vision.test.ts` for short causal controls.
- B-D compact ecology baseline is now an observational, fixed-seed
  diagnostic capability. `ecologyAudit.ts` and `ecologyBaseline.ts`
  count actual absorbed-joule event deltas, completed death causes,
  outstanding egg funding, laying separately from hatching, population,
  stored reserves and conservation error. Receipts coalesce in place;
  sample every tick and never sum the same receipt's lifetime amount
  repeatedly. Eight event slots per organism prevent comprehensive
  high-density event accounting. Run `tests/ecology-baseline.test.ts`
  in the fast suite; optional JSON replay is `npm run benchmark:ecology`.
  Measured three free-roaming worlds produced zero ingestion in three
  seconds; controlled visual feeding, deliberately pre-funded adults
  and deliberately depleted animals prove only localized mechanisms.
  B-A–B-D is complete as a **bounded instrumented prototype**, NOT
  established sustainable ecology, learned survival, or universal
  predator tracking. No extra survivor subsidies or automatic feeding.
  Original Phase 5 now has an initial somatic learning mechanism, but
  physical ecological benefits and Phase 6 sleep/replay are still open.
- Labels B-A–B-D describe the completed bounded behavior workstream,
  distinct from ongoing original Phase 5 (waking learning first slice)
  and original Phase 6 (optional sleep/replay after real behavior benefit).
- Phase 5C inherited visual steering: for newly created FND-001 in balanced
  mode only, retinal->hidden gain is 1.5 (other founders .2) and the
  hidden->joint Angle prior is (-.5, +.5) rather than (+.04, -.04).
  The genotype contains normal evolvable brain weights, not a target oracle
  or runtime reflex. Existing snapshot genomes and unbiased mode are not
  recalibrated. Short six-second, real-contact tests yield food intake in
  7/8 off-axis positions versus 0/8 for retinal-blind and previous weak
  weight controls. RGB pixels do not indicate predator intent: effective
  escape remains unproven. Current-only documentation:
  `docs/wiki/Sensory-Behavior.md`.
- Phase 5: FND-001 gets an explicit head-first joint-phase reversal at
  `createFounderGenome` time only, justified by paired real-physics trials.
  Do not reverse the entire catalogue: FND-051 already swims forward. Maintain
  this single reviewed exception in founder integrity tests. Do not alter saved
  genomes on import. Current sensory-driven pursuit/escape remains unproven.
- Controlled `tests/behavior-baseline.test.ts` trials compare vision on/off,
  ray detections, motor responses, physical travel, feeding and energy in
  short seeded scenarios; they are not ecological fitness evidence.
- Curated starter Bank (v0.26.0): `FEATURED_STARTER_SPECS` in
  `founders.ts` contains nine new, separately identified CUR-001–009
  variants from nine distinct FND donor families (4 herbivores, 3
  omnivores, 2 carnivores). Keep all 55 `FOUNDER_BLUEPRINTS` intact and
  accessible in the Bank Legacy section. Default starting worlds still
  distribute 18 animals over at most five random *featured* genotypes;
  showcase spawns all nine only by explicit user choice. The new inherited
  RGB sensitivities/learning alleles are mutable, metabolic, and never
  scripted targeting. Preserve FND-001's calibrated phase/retinal prior
  when deriving CUR-001. Do not equate bounded swimming and mouth tests
  with sustainable ecological fitness. Use
  `tests/featured-starters.test.ts` in the fast gate.
- v0.27 ecological environment: new 2D UI worlds default to Uniform,
  with an optional Blooms distribution (65% clustered across twelve seed-stable abiotic
  sites, 35% dispersed). Uniform/absent nutrientPattern MUST retain
  exactly the old position and PRNG stream; old imported saves default to
  uniform. Feed/Feed All manual patch placement takes precedence and
  retains its old semantics. `nutrientBloomCenters` may not consume the
  world's PRNG, track creatures or inject energy; all food creation
  still uses `addNutrients`, external input ledger, inflow/target cap.
  New pattern is validated/persisted in schema v11, with no 3D changes.
  `ecologyBaseline.ts` has an optional nine-founder 400-food
  uniform-vs-bloom unassisted comparison; intake receipts can be broken
  down by organism, but do NOT claim bloom viability without evidence.
  Fast bound: `tests/abiotic-blooms.test.ts`. Future work should
  address concrete natural intake/egg failures, not optimize a survey.
- `data/founders.json` contains 55 distinct blueprints (50 revised originals and
  five jellyfish designs). Preserve their actual anatomy and measured gaits; never
  replace entries with renamed duplicates. Selective symmetry is not a mutation rule.
- Anatomy v1 uses one physical connection OR three organs combined per face.
  Count both ends of hinges. Preserve stable organ slots and IDs across mutation,
  pruning, imports and brain remapping. Use getOrganAnchor for vision, bites,
  markers, previews and debug ray origins. Legacy saved positions stay centered
  unless their explicit slots say otherwise; do not rewrite living legacy anatomy.
- Default seeding distributes 18 organisms across up to five uniformly sampled
  distinct designs, with independent genomes. Default nutrients are 400.
  Specialist mouths transfer 3600 J/s and omnivores 1800 J/s gross
  before 80% assimilation. Egg reserve funding uses the parent's inherited
  eggReserveFraction × 10,000 J; retain at least 12% of storage capacity
  (minimum 2,000 J) in the parent. No unfunded egg or automatic survival aid.
- Maintenance uses geometric body area, not construction joules. Keep reserve,
  construction energy, storage capacity, and heat/removal accounting distinct.
- Vision is black except for physical creatures, food and white eggs. Display
  glows/pulses and tank walls must not affect retinal RGB or hit geometry.
- All mouth transfers apply 80% assimilation, stacking the existing carrion
  digestion factor; rejected energy becomes heat. Use addNutrients for all
  external plant-food creation so manual feeding obeys the environmental cap.
- Body contacts resolve on the common substep clock. Exclude directly hinged
  neighbors; preserve mass-weighted COM and hinge stability during self-contact.
- Floating windows must fit the tank viewport between toolbars. Canvas backing
  dimensions must follow its CSS area/device-pixel ratio without stretching.
  Noninteractive notification banners must not intercept pointer input.
- No hidden refills, replacement creatures, death immunity, target-coordinate
  steering, or fabricated diagnostic pass flags.
- World swaps/resizing use a UI render epoch so callbacks with old settings cannot
  step replacement state before its matching pause/settings render.
- New imports must be validated before replacing the active world. Current
  snapshots must continue exactly, including PRNG, activations, counters and IDs.
- Default verification is `npm run test:fast` and `npm run build`. Prefer pure
  geometry/state assertions and a few kernel ticks. Full `npm test`, browser tests,
  ecosystem/behavior benchmarks and manual browser checks are opt-in for a concrete
  unresolved regression or an explicit user request; do not repeat them routinely.
- Hatching requires a clear whole-body envelope and tank containment. Blocked eggs
  keep funded energy and hatch heading; they wait rather than spawning interlocked
  with a passerby or consuming new randomness on every attempt.
- Record measured results and limitations in `docs/PROJECT_STATUS.md`. Distinguish
  controlled swimming, neural response, and ecological behavior in reports.
- Work through a branch and PR. The main-branch Pages workflow deploys only after
  its fast automated tests and build pass. Extended checks are opt-in.
