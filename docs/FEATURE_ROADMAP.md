# VIDA: remaining features — 2026-10-20 / v0.26.0

This is a focused review of the current 2D source, not an implementation promise.
Small changes fit the existing systems. Big changes affect simulation architecture,
biology or behavior and need their own focused updates. Optional extensions are
distinguished below from gaps in existing systems.

## Small

| Addition | Current gap and purpose |
| --- | --- |
| Bank favorites and sorting | Search, family/diet filters, previews, saving and spawning already exist. Add pinned designs and useful sort choices; do not replace those controls. |
| Environment profiles | Save and restore named settings profiles without replacing the active world with a full snapshot. Full ecosystem JSON save/load already exists. |
| CSV statistics export | Export population, diets, births/deaths and energy counters. The existing population plot keeps a short 60-sample history; a full experiment log is a larger feature. |
| Population anatomy summary | Show distributions of parts, eyes and mouths to make structural evolution visible without opening each creature. Genome mutation already adds/prunes parts and organs. |

## Big

| Work | Current state and intended improvement |
| --- | --- |
| Reliable sensory-driven behavior | The balanced Darter has measured retinal food approach and evolving injury-sensing motor circuits. New paired real-physics tests against self-propelled hunters report 6 improved, 2 tied, 1 worsened outcomes among 9 biting starts, with 6 no-bite setups excluded. Across five body types and 15 genuine biting encounters, the same injury response improves 5, worsens 6, ties 4. The Brain inspector exposes the actual injury signal, pending energy and active inherited synapses. Per-eye inherited RGB receptor gains (including zero) and metabolic sensing costs now evolve, without altering legacy genomes; spectral suppression can hide purely green surfaces but does not erase red/blue reflections from real food. A heritable lateral RGB-to-joint circuit now produces genuine late bites in 4 of 24 paired self-propelled-prey trials versus none in blinded controls; center-of-mass approach was worse than the controls. This is limited evidence for sensory-driven moving-prey attacks, **not reliable pursuit**. Move to the bounded B-D ecological baseline rather than prolonged founder/brain tuning. |
| Biological trait trade-offs | Egg reserve allocation now affects the actual funded hatchling reserve, parental energy cost and first-egg threshold; a higher allele improves starting reserves but delays reproduction. Parent survival floor and faster physical feeding were rebalanced in v0.10. Pending: review unused `reproductionThreshold` and other inherited efficiency/storage trade-offs separately without disguising them as guaranteed improvements. |
| Evolvable neural structure | Phases 1–2 support inherited hidden sizes (1–96), neuron identity, connection masks and bounded upkeep. Phase 4 adds inherited activation memory time constants (0–4 s). Phase 5 now permits bounded personal changes in existing retinal and motor synapses, with energy-paid consolidation and forgetting, but **not** within-life neuron/topology growth. One controlled later feeding arrangement improved by 180 J; another worsened by 420 J. General ecological fitness remains unproven. |
| Growth, injury and gradual aging | Juvenile/adult/aging labels exist, but real body growth, local tissue injury/repair and gradual senescence are absent. These require consistent mass, geometry, energy and controller updates. |
| Environment and communication (optional) | Currents and resource patches could create niches. Chemical or acoustic organs would add new physical signals and sensory channels. Current sound effects are presentation, not creature communication. Implement these as separate systems, not one large update. |
| Performance at larger populations | Body contacts have spatial indexing; sight still scans objects. Index perception and move the simulation to a Worker while preserving deterministic stepping and UI responsiveness. |
| Experiment archives and comparison | Current branching replaces the active world with a cloned snapshot; it does not retain multiple named worlds for switching/comparison. Add an archive, event history and repeatable cross-seed comparisons. Deterministic snapshot continuation already exists; playback/rewind does not. |

## Milestones, without overlapping phase numbers

The **original implementation handoff** specified Phases **1–6**. Phases 1
(variable brain size), 2 (inherited brain-structure mutations), 3 (biological
trait/egg trade-offs in the completed core scope) and 4 (evolvable activation
memory timescales) are implemented. They are **not** evidence of learning
within one creature's life.

The subsequently added behavior sequence is now labeled **B-A through B-D**,
rather than confusingly reusing the original Phase 5:

- **B-A — movement/retinal diagnostics:** completed (previously 5A).
- **B-B — evolvable physical motor control:** completed (previously 5B).
- **B-C — sensory-driven feeding/predation/defense:** bounded capability
  implementation completed (previously 5C), but **reliable pursuit remains
  unsolved**. A balanced Darter feeds using inherited color circuits,
  descendants can evolve RGB receptor sensitivity and injury responses,
  and a rare isolated lateral retinal-turn neuron can produce real
  predator bites *after prey has physically swum 30–90 px*, unlike its
  identical disconnected controls (4/24 tested genotype/side pairs).
  None of those pairs improved closest center-of-mass approach. This is
  an evolutionary possibility, not ecological viability, generalized
  prey tracking, a guaranteed predator strategy or synaptic learning.
- **B-D — compact ecology baseline:** **completed as a bounded measurement
  milestone** (previously 5D). Native-physics 3-seed free-roaming worlds
  with 4 founders and 60 food particles showed all survived 3 seconds
  but **none fed**. In contrast, eight six-second controlled sighted
  Darter trials absorbed 816–1,680 J versus no intake in retinally
  disconnected controls. Three pre-funded mature cohorts laid real
  funded eggs, while three initially impoverished juveniles starved
  and left conserved carrion. Paired controls, exact state measures,
  death causes and reserve/heat/egg energy are now reproducible from
  `npm run benchmark:ecology`. This is **not** sustainable ecology,
  natural-selection fitness or successful multigeneration breeding.

**The B-A–B-D prototype capability/measurement workstream is closed.**
The measured short free-roaming result remains negative for independent
food acquisition; therefore ecological viability, robust active predator
pursuit and multigeneration adaptation stay separate open scientific
outcomes rather than silently being marked solved.

- **Original Phase 5 — waking lifetime learning:** **COMPLETE as an implemented, bounded capability**; ecological learning reliability remains an independent unresolved outcome.
  The first bounded implementation includes rare heritable plasticity
  and forgetting rates, up to 96 individual somatic motor-synapse
  adjustments, eligibility over recent activity and **reward solely from
  genuine mouth absorption**. Changing learned weights and their
  upkeep cost conserved reserves; newborns inherit only the baseline
  genes, not their parent's experience; brain inspector shows effective
  learned motor weights. In a controlled non-swimming operant trial,
  actual 2,400 J absorbed food raised one Angle neural response from
  ~0.642 to ~0.691; unfed same-genotype control stayed ~0.642.
  This proves within-life conditioned neural adaptation but
  **does NOT yet prove improved physical food-seeking, life expectancy,
  predation or ecological fitness**. Next: short paired multi-episode
  physical acquisition/survival tests of *learning versus no learning*,
  with relevant control conditions and no hand-injected rewards.
  **v0.22 expands useful learning capabilities without reopening
  long testing phases:** rare, inherited all-channel plastic motor
  scope and separately evolvable genuine bite-based aversion.
  Offsets still pay energy and remain somatic; old Angle-only
  brains stay unchanged. Brief physical checks establish actual
  multi-output learning and bite-conditioned synaptic change,
  not improved survival or ecological fitness. Follow up with
  normal feature development and only bounded physical benefit
  checks as each new capability warrants.
  **v0.23 adds sensory-context learning:** rare inherited
  retinal-plasticity capability modifies an individual's
  enabled RGB-eye-to-hidden synapses following real food
  intake or injury. The acquired associations affect
  subsequent neural and motor responses and are saved
  but never inherited as experience. A compact physical
  food test showed 1,440 J of ingestion and a changed
  post-experience retinal response versus an erased
  learned-memory clone. No generalized adaptive behavior
  or long-term fitness improvement is claimed.
  **v0.24 selective long-term retention:** an additional
  inherited consolidation rate protects personally
  learned visual and motor connections only when later
  genuine reinforcement is consistent; contradictory
  feedback and no-reward time weaken retention. Strong
  memories cost more energy. Four seconds after the
  last food, matched learned-weight clones retained
  0.5673 vs 0.3869 total learned-weight magnitude
  with/without stabilization (47% increase), not
  proven better navigation or feeding. The remaining
  **v0.25 functional closure:** a freely swimming articulated
  learning-capable Darter genuinely fed from a finite patch,
  and an exact-state trained-versus-erased-memory comparison
  tested another physical food target. One of four
  post-learning setups benefited by **180 gross J**,
  one was harmed by **420 gross J**, two tied.
  True swimming, ingestion and conserved energy were
  checked; a short 100-creature bounded smoke check
  exercises the combined learning machinery.
  This closes the **core waking-learning implementation**,
  NOT reliable foraging, generalization, 1000-part performance,
  effective natural selection or ecosystem sustainability.
  Remaining behavioral reliability belongs to future
  fitness/niche work. **Phase 6 optional sleep/replay**
  remains separate and not implemented.

- **Original Phase 6 — optional rest/sleep and replay:** **not implemented**.
  Only consider after waking learning improves *physical behavior*, rather
  than merely adapting a motor response in an immobile laboratory animal. Bound experience
  buffers and computation, leave resting organisms physically vulnerable and
  energetically accountable, and compare against equal-compute waking learning.
  World-model dreaming is a later optional idea, not an existing feature.

The **v0.26 featured founder bank is implemented**: nine separately identified
curated genotypes drawn from nine distinct source families (four herbivores,
three omnivores and two carnivores). All 55 originals remain accessible in
the Legacy Bank collection, alongside Saved specimens. Ordinary new worlds
choose up to five of the nine featured genotypes, while the full featured
showcase is explicit. Their inherited eye spectra and some learning rates
are mutable; known legacy swimming gaits, physical feeding and metabolism
remain in place. Short focused checks do **not** establish natural food
acquisition or population fitness.

**Next: ecological viability based on those nine starters**, in bounded
increments. First measure real unassisted mouth absorption, replenishment
and egg completion without subsidies; then measure predator/prey interactions
and only fix concrete learning/locomotion limitations revealed by the data.
Evaluate evolving generations only after reproduction works naturally.
Do not run prolonged genotype tuning, guarantee survival, or start optional
Phase 6 sleep/replay yet.

Monitor performance only if measured bottlenecks arise.

## Limits that remain corrections rather than new features

- Collision response uses discrete substeps, not continuous swept collision.
  Directly hinged neighbors can still intersect at tight bends. Eggs/food use their
  existing contact models rather than full rigid-body response.
- Jellyfish are hinged rectangular swimmers; deformable bells and fluid jets are
  not implemented. The new variants have bounded two-second gait checks, not
  measurements of lifetime ecological fitness or reliable hunting.
- Historical reports in PROJECT_STATUS describe their own versions. Old statements
  that save continuation, solid body contacts or motor amplitude control are
  missing are superseded by the later implementations.
