Continue **VIDA 2D** from [#57](https://github.com/smeagol44/vidAI/issues/57), completed moving-nutrient experiment [#100 / draft #101](https://github.com/smeagol44/vidAI/pull/101), and uncapped plasticity experiment [#98 / draft #99](https://github.com/smeagol44/vidAI/pull/99).

# Experiment: Moving nutrient with 90 px graded feeding and inherited mutation targeting

## Objective

Repeat #101's moving-nutrient experiment, with exactly TWO deliberate experimental changes:

1. **Linear proximity feeding:** creatures absorb real, properly accounted nutrient energy when their physical mouth is within 90 px of the nutrient surface, with feeding strength decreasing linearly to zero at that distance.
2. **Custom mutation targeting:** two of the four genetically MUTABLE neural hybrids preferentially mutate 66% of the neural parameter locations their immediately preceding parent originally mutated.

All other #101 conditions remain unchanged.

## 1. Controllers and seeds

Run the following five independent evolutionary populations:

| Controller | Neural seed | Mutation algorithm |
|---|---|---|
| Legacy six-output | 17 | Original random |
| MUTABLE two-output hybrid | 17 | Original random |
| MUTABLE two-output hybrid | 1901 | Original random |
| MUTABLE two-output hybrid | 71 | **66% parent-targeted** |
| MUTABLE two-output hybrid | 4099 | **66% parent-targeted** |

The four original hybrid seeds remain included. This is a fixed assignment, not a performance-based choice.

**Limitation:** Mutation algorithm and seed differ between groups, so differences between these two-versus-two groups cannot establish a causal advantage of the targeting algorithm. Report individual outcomes rather than treating them as matched pairs.

## 2. Exact evolutionary budget

For every population:

- 10 generations.
- 10 offspring per generation.
- 15 simulated seconds per trial.
- Exactly eight neural scalar mutation events per offspring.
- Gaussian mutation magnitude sigma 0.15.
- Original weight/bias bounds.
- Original frozen-generation parent model.
- Parent replacement only for strictly greater actual absorbed nutrient J.
- Ties retain the existing parent.

The four MUTABLE populations retain all original heritable learning traits, plastic-synapse masks, their additional mutation attempts, lifetime learning, energy charges and inheritance rules.

Total: **500 offspring, five founders and 15 original held-outs**.

No extra evolutionary evaluations, neutral drift, hidden fitness or secondary selection criterion.

## 3. NEW custom mutation algorithm — 66% parental targeting

Apply this algorithm ONLY to MUTABLE hybrid seeds 71 and 4099.

### A. Preserve each selected parent's original mutation history

Whenever an offspring is genetically created, record which neural parameter coordinates were actually modified in that offspring relative to its own parent.

Coordinates must use stable identities and include:

- Input-to-hidden weights (IH).
- Recurrent hidden-to-hidden weights (HH).
- Hidden-to-output weights (HO).
- Hidden biases.
- Output biases.

A coordinate identifies one actual scalar parameter, not a generic neuron label.

Retain the exact before/after values, mutation receipts, repeated-coordinate events and original genetic parent identity.

Keep these records as experimental lineage metadata, not extra neural inputs or inheritable somatic learning state.

### B. Initial randomly generated parent

The original randomly initialized founder has no parental mutation history.

Therefore its offspring use the original unrestricted random neural mutation process.

Do not artificially invent eight parental mutations or classify the entire randomly initialized brain as a parental mutation set.

This also applies whenever the selected parent remains the original founder, regardless of generation number.

The first selected offspring that was itself created through recorded neural mutation becomes eligible to pass its original mutated-coordinate set to subsequent children.

This implements the owner's intended generation-1/generation-2 exception without relying on ambiguous generation labels.

### C. Targeting algorithm for later children

Once the selected parent has a valid mutation-origin record:

1. Extract its set of distinct neural parameter coordinates that changed during its own creation.
2. Each new child receives exactly eight ordinary Gaussian neural mutation events.
3. On average, **66% of those eight events target coordinates in the selected parent's original mutation set**.
4. The remaining approximately 34% target new randomly selected neural parameters outside that set.
5. Mutation magnitudes and bounds remain exactly the same as the original algorithm.

For eight mutation events, use seeded randomized rounding:

- Five parental-targeted events with 72% probability.
- Six parental-targeted events with 28% probability.

This gives an expected targeted count of 5.28/8 = 66%.

Select parental coordinates uniformly without replacement when enough distinct coordinates exist.

If the parent has fewer eligible distinct changed coordinates than required, use each available coordinate at most once and fill the remaining events with ordinary random mutations outside that set. Report the realized targeting percentage rather than pretending to achieve 66%.

The remaining random mutations must remain genuinely random across eligible, non-parental neural coordinates.

No fixed preference for eye neurons, motor heads, recurrent neurons, direction of movement or particular neural outputs.

### D. Critical lineage behavior

Target the mutations that happened **when the current parent was genetically born**, not every change accumulated throughout its ancestry.

For example:

- Founder A: randomly initialized, no known parental mutation coordinates.
- Child B: receives ordinary random mutations.
- If B becomes the selected parent, its children preferentially target B's birth-mutation coordinates.
- If child C becomes the selected parent, its children preferentially target C's birth-mutation coordinates instead.
- If B remains selected for several generations, later children continue using B's original coordinates.

Never use acquired lifetime synaptic changes as inherited mutation targets.

Do not permanently lock those coordinates or disable mutation elsewhere. Every neural parameter must remain reachable by genetic mutation over time.

### E. Determinism and fair bookkeeping

Use a separately derived deterministic PRNG stream for parental-coordinate selection and randomized rounding.

Preserve the original neural Gaussian distribution, inherited plasticity mutation mechanism and lifetime-learning PRNG streams.

Record the exact targeted/random decisions, parameter coordinates and mutation receipts for every child.

The algorithm must be identical for both custom-mutation seeds.

Do not alter mutation magnitude, total mutation budget, motor strength or sensory architecture.

## 4. NEW linear proximity feeding

Preserve the ordinary single moving, inexhaustible nutrient from #101, but allow experimental distance-based transfer.

Let `d` be the nonnegative physical gap between the nutrient surface and the nearest point of the creature's actual mouth feeding capsule.

Define:

`feedingStrength = clamp(1 - d / 90, 0, 1)`

Examples:

- 0 px: 100% feeding strength.
- 22.5 px: 75%.
- 45 px: 50%.
- 67.5 px: 25%.
- 90 px or farther: 0%.

Calculate energy transfer from the original mouth feeding budget multiplied by this strength, preserving all normal capacity limits.

Use the unchanged 80% assimilation rate, energy conservation, heat accounting and externally funded inexhaustible nutrient reservoir.

Do not use Infinity as a stored energy value.

### Preserve truthful senses

- `mouth:contact`: TRUE only for genuine physical mouth contact.
- `mouth:intake`: continuous normalized actual energy intake, including graded non-contact intake.
- `body:feeding`: TRUE only when actual energy was received.
- Lifetime motor/sensory reinforcement: use the existing proportional intake signal, with no added artificial reward.

A creature near a nutrient receives real energy and can learn from that energy, but it must not receive any additional reward for proximity alone.

Physical-contact and non-contact proximity feeding must never be double-counted.

This new mode is an experimental exception; normal VIDA feeding must remain physically contact-based.

## 5. Preserve #101's environment exactly

- Arena: 4800×3000 px.
- Original CUR-001 Darter body, eyes and mouth.
- Initial root (2400,1500), heading 0.37.
- Environment seed 73.
- Water viscosity 0.18; gravity 0.
- `passive-work-v3` and ordinary physical joints/collisions.
- Original finite, funded 10,000 J reserve.
- ONE inexhaustible nutrient, initial ordinary 3000 J stock and 18 px radius.
- Initial nutrient position 120 px ahead of the mounted forward eye.
- Nominal nutrient speed 22 px/s.
- Direction decisions every 1.5 seconds.
- 25% scheduled stop probability.
- Random outward/sideways travel, never voluntarily toward the creature.
- Immediate, permanent stationary latch beyond the original 405 px radial viewing boundary.
- Original separate deterministic environmental PRNG.
- Original normal mortality and metabolic rules.

Preserve all existing non-teleportation and energy-accounting safeguards.

## 6. Preserve uncapped experimental physics

Use #101's isolated uncapped Worker simulation.

No 400 px/s linear velocity cap or ±20 rad/s angular velocity cap.

No threshold-based evolutionary rejection for historical guard, joint-overshoot, anchor or boundary diagnostics.

Keep genuine physical constraints, funded motor forces, water resistance and numerical integrity checks.

Do not retune physical parameters.

## 7. Measurements

Report all five generation 0–10 nutrient-intake curves.

For every selected specimen and relevant offspring, measure:

- Total absorbed J.
- Physical-contact versus proximity-feeding J.
- Nutrient-feeding intensity versus mouth distance.
- Mouth-to-nutrient minimum separation.
- Nutrient moving/paused/frozen feeding breakdown.
- Actual nutrient detection.
- Total 15-second COM path distance, net displacement and late movement.
- Motor-mode usage and physical torque delivery.
- Actual motor/sensory lifetime learning and its cost.
- Energy accounting and former physical diagnostics.

For the two custom mutation populations, ALSO record:

- Parent's original mutated neural coordinates.
- Number and fraction of child events targeting those coordinates.
- Number and fraction exploring other coordinates.
- Whether the selected parent was a founder or previously evolved child.
- Mutation-coordinate reuse over the selected ancestry.
- Strict feeding improvements and inherited learning-trait/mask changes.

Distinguish improved locomotion, better nutrient proximity and prolonged stationary feeding.

Do not claim that feeding from 90 px away demonstrates physical mouth contact or active pursuit.

## 8. Original held-outs

Test the five final specimens for 15 seconds each under the original deterministic held-out conditions:

- Seed 811, heading −0.7.
- Seed 977, heading 2.3.
- Seed 2301, heading π/2.

Apply the same moving nutrient and new proximity-feeding rule.

These 15 evaluations must not influence parent selection.

If evolution selects no improved offspring, retain and label the unchanged founder.

## 9. Required verification

Before training, preregister the exact protocol and create a new bounded issue linked from #57, plus an isolated branch/draft PR.

Preserve #101 and #99 source, historical saves and evidence.

Tests must cover:

- 0/45/90 px proximity strength, including boundary cases.
- Correct capsule geometry and physical-contact truthfulness.
- No duplicated feeding or unaccounted energy.
- Graded mouth inputs and actual learning reinforcement.
- Initial founder with no parental mutation history.
- Children of the founder receiving original random mutation.
- A selected evolved parent passing its original mutated-coordinate set.
- Five/six randomized rounding at the correct expected ratio.
- Duplicate or absent parental mutation coordinates.
- Exact eight-event mutation budget.
- No inherited somatic learned-state contamination.
- Original random-mutation hybrids remaining unchanged.
- Deterministic Worker replay and snapshot/reset continuation.

Perform the standard focused tests, build, full experiment audits and relevant Worker checks.

Keep immutable, independently recoverable generation checkpoints and provenance as in #101.

Execute only the authorized 500-offspring budget. Never silently repeat or replace completed experimental outcomes.

## 10. Final deliverables and stopping point

Provide:

- Five evolution curves in CSV/JSON.
- Founder and final feeding performance.
- Standard-versus-custom mutation outcome summaries.
- Full parent-target coordinate statistics.
- Held-outs and proximity-feeding breakdown.
- Complete creature/nutrient trajectories.
- Actual learning and movement results.
- Energy/numerical audit, CI and evidence links.

Compare descriptively with the original zero-feeding #101 experiment, identifying the deliberate feeding-rule difference.

Do not draw a causal conclusion about the mutation algorithm from unmatched seeds.

Update the active issue, #57 and draft PR.

**STOP for owner review. No merge, deployment, Wiki edits, production/testing release changes, extra experiment or VIDA 3D modifications.**