Continue development of **VIDA 2D** using [#57](https://github.com/smeagol44/vidAI/issues/57), the completed uncapped plasticity comparison [#98 / draft PR #99](https://github.com/smeagol44/vidAI/pull/99), and the original legacy locomotion study [draft PR #85](https://github.com/smeagol44/vidAI/pull/85).

# New experiment: Evolutionary pursuit of a single moving, inexhaustible nutrient

## Objective

Determine whether VIDA organisms can evolve to pursue, physically contact and repeatedly feed from a moving nutrient, comparing:

- **ONE legacy six-output controller** with its original fixed lifetime-learning system.
- **FOUR genetically MUTABLE two-output neural hybrids**, using the inherited plasticity/mask system from #99.

All five runs use the same experimental physics, nutrient rules, evolutionary selection criterion and evaluation duration.

This is an experimental moving environmental resource, NOT a live-ecosystem fitness mechanism.

## 1. Evolutionary budget

Preselect the following independent neural seeds:

- Legacy: **17**
- MUTABLE hybrids: **17, 71, 1901, 4099**

Use these predetermined seeds without substituting later winners or dropping weak outcomes.

For EACH run:

- 10 generations.
- 10 offspring per generation.
- 15 simulated seconds per evaluation.
- Every offspring descends from its generation's frozen starting parent.
- Strictly greater actual nutrient intake replaces the parent; ties retain the parent.

Total: **500 offspring, five founders, 50 generation-level selection decisions**.

Use exactly the original eight neural scalar mutations with replacement, Gaussian sigma 0.15, bounds and streams.

Legacy preserves its original six-output genes and fixed learning. MUTABLE hybrids preserve #99's two-output Mode/Command architecture, revised −0.9/0/+0.9 bands, 0.06 hysteresis, inherited learning traits, eligible synapse masks and their original additional mutation budget.

Do not reinterpret historical genes or neural outputs.

**Scientific caveat:** legacy and MUTABLE hybrids differ in both motor architecture and learning genetics. This is a behavioral performance comparison, not a controlled isolation of either mechanism.

## 2. Experimental environment

Use the unchanged CUR-001 Darter body, physical mouth and eye geometry, ordinary drag, muscle strengths, neural sensing, metabolism, physical feeding and energy conservation.

- Water viscosity: 0.18.
- Gravity: 0.
- Mechanical model: `passive-work-v3`.
- Large 4800×3000 px arena to avoid accidental wall interference.
- Initial root: (2400,1500), heading 0.37 radians.
- Normal funded 10,000 J initial creature reserve.
- Exactly ONE nutrient.
- No other nutrients, remains, eggs or resource inflow.

Use ordinary mortality and the existing biological rules; do not introduce free survival or energy subsidies. The 15-second duration is below the Darter's normal 18-second maturity.

Full deterministic world reset before every trial.

### Nutrient placement

Place the nutrient **120 px directly ahead of the creature's forward eye**, rotated with the creature's starting heading.

Use the actual eye attachment and physical coordinates rather than assuming the eye is at the root COM.

Verify that:

- It is initially within the creature's actual eye field of view and detectable by ordinary visual rays.
- It is NOT initially touching or inside the mouth's physical feeding region.
- Initial nutrient geometry is exactly matched across all five runs.
- Its initial placement is independent of brain outputs.

Preserve the ordinary nutrient's size, color, vision behavior and physical mouth-detection rules.

## 3. Infinite-energy nutrient

The single nutrient must **never disappear or become depleted**, even after repeated feeding.

Implement it as a nutrient backed by an explicitly unbounded **external environmental energy reservoir**, NOT as a floating-point `Infinity` value.

Preserve the ordinary mouth contact, bite rate, assimilation efficiency, metabolic costs and energy-transfer rules.

For every amount of energy physically removed through normal feeding:

- Transfer energy using the existing feeding/assimilation accounting.
- Replenish the source from its external reservoir.
- Record that amount as explicit environmental energy entering the system.
- Keep the nutrient's physical size and visible properties unchanged.

No mouth contact means no transferred calories. Do not give organisms energy for proximity, seeing the nutrient or merely following it.

The nutrient should remain the only feeding source for all 15 seconds.

## 4. Nutrient motion

Use a fixed nominal movement speed of **22 px/s**.

This approximates half the historical legacy swimming speed: #85's three final legacy organisms averaged approximately 221.65 px net displacement over five seconds, corresponding to 44.33 px/s.

This is an approximate displacement-based reference, not a claim about precise instantaneous swimming speed.

### Movement schedule

Divide each 15-second evaluation into **ten 1.5-second intervals**.

At the start of every interval:

1. Use a separate deterministic nutrient-motion PRNG.
2. With **25% probability**, select STOP for the whole interval.
3. Otherwise, select a random permitted heading and move at 22 px/s for that interval.
4. Hold the selected heading until the next scheduled 1.5-second interval.

Movement must be smooth integration, not teleportation. No gradual interpolation or steering toward the organism.

Save every motion decision, heading, stop interval and actual trajectory.

### Never move toward the creature

The nutrient may move sideways or away from the creature, **but never voluntarily toward it**.

At a heading-selection event, choose uniformly from the outward-facing angular half-plane relative to the nutrient's current position and the creature's actual COM.

Require the nutrient's velocity component toward the creature to be nonpositive.

If the creature moves such that the nutrient's existing heading would subsequently point toward it, pause the nutrient for the remaining part of that interval. Do not introduce an unscheduled new heading or steering response.

Select a fresh heading only at the next normal 1.5-second interval.

The creature is free to approach the nutrient through its own physics. The nutrient is not allowed to move toward, orbit in pursuit of or intentionally collide with the creature.

This rule is part of the externally prescribed experimental environment. It must NOT expose creature position, nutrient coordinates or a hidden target vector to the neural network.

### 90% visual-range stopping rule

The CUR-001 Darter's two eyes have a nominal range of **450 px**.

Set the radial stopping threshold to **405 px**, equal to 90% of that range.

Use the nutrient center's actual distance from the physically mounted eye origins, with the target remaining within range while at least one eye is within the threshold.

When the nutrient first exits that 405 px range:

- Stop its movement immediately at the crossing boundary.
- Permanently latch it to STATIONARY for the remainder of that trial.
- Do not restart it if the creature approaches later.
- Keep it visible and physically edible under the ordinary vision and mouth rules.
- Never teleport it back into view.

Apply this check during simulation updates, including when the nutrient is temporarily paused. Avoid one-frame movement beyond the threshold through swept or substep crossing detection.

The radial cutoff is separate from the actual eye field of view. Losing angular visibility does NOT automatically stop the nutrient.

Do not give the creature privileged information about the cutoff or any special target-seeking input.

### Determinism and fairness

Use the same predeclared movement probability, speed, start offset and update rules in every architecture.

Use separate seeded PRNG streams for nutrient motion that cannot alter the brain/mutation/physics random streams.

Pre-sample stop decisions and angular offsets for all ten intervals so behavior-dependent random draw counts cannot alter future schedules.

Keep training schedules deterministic and reproducible; use independent held-out schedules for generalization.

Because permitted directions depend on the actual creature position, the realized nutrient trajectory can differ between organisms. Disclose this closed-loop environmental difference rather than claiming every genome saw identical paths.

## 5. Physics and evolution

Use the already established **isolated uncapped Worker physics** from the #98/#99 experiment:

- No 400 px/s translational part-speed clamp.
- No ±20 rad/s angular part-speed clamp.
- No replacement artificial speed limits.
- No rejection of offspring for historical joint-limit, anchor, velocity, boundary or numerical-tolerance thresholds.

Preserve actual hinge mechanics, joint constraints, collisions, fluid resistance, finite actuator capacity and energy prepayment.

Former thresholds are read-only diagnostics. Genuinely nonfinite or corrupted physics must be reported transparently rather than silently repaired.

**The sole selection score is real nutrient energy absorbed during the 15-second trial.**

No distance reward, speed reward, target-distance reward, pursuit bonus, contact-without-feeding reward or fitness penalty.

Every selected improvement must come from ordinary physically verified mouth intake.

## 6. Behavioral measurements

In addition to selection intake, record these diagnostics for every founder, offspring and champion:

- Nutrient positions, heading changes, moving/stopped intervals and final freeze event.
- Actual eye-ray nutrient detections.
- Creature COM and mouth trajectories.
- Distance between mouth and nutrient over time.
- Minimum separation and first physically verified mouth contact.
- Total absorbed energy and actual feeding ticks.
- Feeding energy while nutrient is moving versus temporarily stopped versus permanently frozen.
- Creature displacement, path length and last-five-seconds movement.
- Physical DIRECT/OSCILLATOR/OFF mode use and late mode switches.
- Acquired lifetime learning, inherited learning traits/masks and paid learning cost.
- Motor work, metabolic expenditure, conservation and numerical diagnostics.

Distinguish **active pursuit of a moving resource** from encountering it after it stopped. Do not infer learned navigation solely from high intake.

## 7. Held-outs

After the ten-generation evolution, evaluate each of the five final champions in three new deterministic 15-second conditions.

Use held-out environmental seeds:

**811, 977, 2301**

Use the same nutrient speed, 1.5-second scheduling, pause probability, starting offset and radial-freeze rule, but independent direction/pause streams and starting headings −0.7, 2.3 and π/2.

This adds **15 non-selecting champion held-outs**, with no additional generations or offspring.

Report intake and how much feeding occurred while the nutrient was moving, temporarily stopped or permanently frozen.

If no evolutionary improvement occurred, evaluate and explicitly label the unchanged founder as the final specimen.

## 8. Results

Produce complete generation-by-generation curves for all five runs:

`controller,brain_seed,generation,selected_absorbed_J`

Report founder/final intake, evolutionary improvements, feeding-offspring counts, nutrient pursuit behavior, physical movement, mode use, learning, energy accounting and held-out reliability.

Create graph-ready CSV/JSON for:

- Five evolutionary intake trajectories.
- Legacy versus four MUTABLE hybrid final performance.
- Held-out results.
- Nutrient distance and movement-state timelines.
- Intake while target is moving versus stationary.
- Selected champion trajectories and physical contacts.

Compare against historical #87/#90/#93/#97/#99 only as contextual benchmarks. Their stationary-nutrient habitats are different; **do not present historical intake values as a same-task ranking**.

## 9. Workflow and verification

- Inspect current `AGENTS.md`, #57, #98/#99 and relevant implemented code.
- Search for an existing matching issue; otherwise create one bounded issue and link it from #57.
- Preregister the complete protocol before running evolution.
- Create an isolated branch/draft PR based on the required #99 functionality.
- Do not modify the original datasets, production settings, saves or historical simulation modes.
- Test target initialization, continuous feeding and explicit reservoir accounting, 1.5-second motion scheduling, no-toward motion, pause intervals, exact visual-range freeze, deterministic replay and Worker authority.
- Ensure the moving source produces no teleports, hidden locomotion forces, impossible energy gains or extra brain inputs.
- Preserve every generation's complete scientific evidence durably, using verified append-only checkpoints and externally recoverable hashes. Learn from the interruption and recovery problems of #96/#97.
- Execute the **500-offspring evolutionary budget once**, plus five founders and 15 held-outs.
- Run focused tests/build, real Worker verification and exact archive/replay auditing.
- No speculative tuning or repeated searches if organisms perform poorly.

If a consequential scientific mechanism cannot satisfy these rules, document the issue rather than silently substituting a different experiment.

Update the active issue, #57 and the draft PR with complete results, recovery provenance if relevant, version/branch details and exact next action.

**STOP for owner review. No merge, deployment, production/testing release changes, Wiki edits, extra experiments or VIDA 3D modifications.**

Return a concise final summary and links to complete graph-ready data so I can compare all five evolutionary curves visually.