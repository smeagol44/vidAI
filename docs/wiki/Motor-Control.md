# Movement and Motor Control

Rectangular body parts connect through physical hinges at their attachment
faces. Joint torques and water resistance produce motion; neural outputs do
not directly set world-space position or grant forward thrust.

Hinge markers are hidden in the display. The joints still constrain and actuate
body parts in the Worker; hiding their dots saves drawing, not physics work.

## Controller

Each joint has six neural outputs:

| Output | Effect |
| --- | --- |
| Angle | Joint posture/target-angle command |
| Drive | Oscillation frequency modulation |
| Torque | Peak torque modulation |
| Stiff | Controller stiffness/damping modulation |
| Amp | Rhythmic stroke amplitude, including suppression |
| Engage | Muscle engagement, including zero active torque |

Inherited phase, frequency and amplitude genes define each joint's rhythm.
The optional `oscillatorMix` gene ranges from 0 (direct posture) to 1 (full
rhythmic contribution). Four optional bounded harmonics permit smooth
non-sinusoidal strokes. On the evolved mixed/direct path, suppressing the
rhythm gives the Angle command full joint travel. Older genes lacking the
new fields use their original sine calculation exactly.

Body geometry, relative timing, force limits and drag determine whether a
stroke produces useful progress. No universal swimming or escape policy is
imposed. Rigid hinged jellyfish do not have deformable bells or fluid jets.

## Motor control loop

```mermaid
flowchart TD
  N["Recurrent neural controller"] -->|"Angle"| T["Joint target calculation"]
  N -->|"Drive and Amp"| R["Joint rhythm"]
  G["Inherited phase, frequency, amplitude and optional harmonics"] --> R
  R -->|"Optional oscillator mix"| T
  T --> M["Bounded muscle torque"]
  N -->|"Torque, Stiff and Engage"| M
  M --> P["Hinges, body inertia and water drag"]
  P -->|"Body and joint feedback"| N
```

The target calculation preserves the legacy path for older genes. Physical
motion, rather than a direct position command, closes the feedback loop.

## Current physics and its limits

| Persisted regime | Behavior |
| --- | --- |
| `passive-work-v3` (new worlds) | Established drag, muscles and prepaid simultaneous actuation; complete joint-velocity solves cannot add kinetic energy beyond roundoff |
| `paid-work-v2` | Same swimming forces and prepaid work with the historical unconstrained joint-bias solve; preserved for saved worlds |
| `surface-work-v1` | Unit-depth four-face drag, geometric muscles and sequential paid impulses; kept for exact continuation of stored worlds |
| `legacy-v0` | Original forces, integration and legacy billing; used by v3–v11 imports |

Schema v15 stores passive-work-v3 with either economy and mouth model. Historical
schemas v12/v13/v14 retain their prior regimes and behavior. Export, fork, Worker commands and fallback
preserve it. Reset creates a current-physics world. A stored surface-model world
can explicitly select **Repair swimming in this world** in settings, keeping its
creatures, eggs, food, time, PRNG and personal memory while changing future
physics. Other saved worlds can select **Stabilize joint solver in this world**.
Both upgrades preserve the exact paused ecosystem and change future physics;
imports never silently convert regimes.

### Working drag and muscle forces

The current world model retains its calibrated anisotropic drag:

```text
Fx_local = -0.05 * mu * h * u
Fy_local = -2 * mu * w * v
drag_torque = -mu * omega * (w^3 + h^3) / 6
```

For average connected-part inertia `Iavg` and the usual neural modifiers:

```text
kp = motorForce * Iavg * 480 * stiff
kd = sqrt(kp * Iavg) * 1.4 * stiff
maxTorque = Iavg * 2200 * torque
command = clamp(kp * angleError - kd * relativeSpeed, +/-maxTorque) * engagement
```

Every joint reads the same substep-start velocities. Equal/opposite motor
commands accumulate with external forces before the original shared velocity
update and hinge solve. Funded muscles retain the established force arithmetic;
no founder/body/brain/phase/weight retuning supplies the recovery.

These are calibrated simulation forces. Axial drag is 1/40 of a uniform normal
four-face reference; uniform 2D size doubling gives 16x torque. They are not
claimed to be a coherent single surface law or biologically justified muscle
scaling. Resolving that model remains open and must preserve functional movement.
No wakes, shielding, fluid motion, deformable bells or jets are simulated.

### Prepaid simultaneous work

Commands remain simultaneous rather than updating one joint's velocity before
calculating the next. For each constant substep angular impulse `J`, actuator
work integrates `J * relativeAngularVelocity` along the actual linear velocity
update, including other motors on shared parts and external torques. Split the
integral at any reversal: positive work is paid independently of negative work
on that or another joint. Acceleration from rest is included.

One mechanical simulation-energy unit is 1.75e-7 J; efficiency is 25%.
Positive work costs `positiveWorkJ / 0.25`; negative work dissipates without
regeneration. If all commands cannot be funded, a conservative work bound
reduces their common amplitude before motion, preserving command balance.
Zero reserves disable muscles. The final measured cost, not the bound, is
charged immediately; later food cannot fund earlier movement. There is no new
40-J billing cap. Muscles spend before basal upkeep, after any waking-learning
charges; unpowered joints and passive contact still operate.

The historical `mechanicalWorkHeat` name denotes chemical motor expenditure,
including allocated work and inefficiency. It does not assert instantaneous
thermodynamic heat. Chemical accounting excludes kinetic energy as a stored term.
Diagnostics expose per-tick positive/negative work, reserve-limited commands
and speed-clamp events (400 px/s, 20 rad/s). Existing guard usage on some body
plans remains a limitation; a passing movement check does not resolve it.

### Surface-model save continuation

Stored `surface-work-v1` worlds retain `Fx=-2*mu*h*u`, `Fy=-2*mu*w*v`, and the
same integrated rotational drag, counting all four unit-depth faces even when
connected/covered. Strength uses stress 300 times the smaller attachment
cross-section and a mean internal lever; doubling lengths gives 4x torque.
PD damping uses reduced pair inertia, and muscles apply sequential prepaid
impulses. This mode's normal-resistance idea follows Karl Sims's
[*Evolving Virtual Creatures*, section 4](https://www.karlsims.com/papers/siggraph94.pdf);
its absolute strength normalization and movement performance are unresolved.
The paper does not establish VIDA's coefficients or validate that normalization.

### Passive joint correction

The ten historical anchor/limit velocity iterations form one provisional batch.
For its aggregate velocity increment, compute the kinetic change at fraction s:

```text
deltaK(s) = s * linear + s^2 * quadratic
linear = sum(m * dot(v, deltaV) + I * omega * deltaOmega)
quadratic = 0.5 * sum(m * dot(deltaV, deltaV) + I * deltaOmega^2)
```

Keep the entire batch if dissipative. Otherwise accept the largest fraction in
[0, 1] with nonpositive kinetic change, using an inward floating-point margin.
When no non-energizing velocity response is possible, repair the joint pose
without changing velocities. Partial responses retain the established pose path.
This bounds the accepted complete batch, not each provisional internal iteration.
Per-tick `constraintLimitedBatches` records intervention separately from speed guards.

Resting and coasting invalid-joint controls repair without kinetic injection or
motor charges. Across nine frozen swimmers at three heading/viscosity pairs,
the largest five-second travel change is 0.13%, with no additional speed guards.
The largest measured positive batch change is below 4e-18 J (roundoff).

Short ecosystems can diverge despite near-identical isolated swimming. In two
60-second paired seeds, the corrected model produces one extra offspring each.
Seed 73 nutrient absorption rises 61%, while prey absorption falls from 4200 J
to zero. These disclosed observations establish neither improved ecology nor
reliable hunting. Genes, diet rates, drag and muscle gains are unchanged.

### Measured speed-guard dependence

A bounded motor-off control of the unchanged Lantern, Forktail and Broadwake
anatomies (five seconds, heading 0.37 rad, viscosity 0.18) isolates the
**necessity of actuation**, not the independent effects of muscle scaling,
contacts or posture feedback. Normal runs hit 352, 116 and 1,106 guard events,
removing 0.119 J, 0.088 J and 2.485 J of kinetic energy respectively. The
identical controls with motorForce set to zero for offline measurement hit
**zero guards**, without changing any production genes or physics. Forktail
has no contact impulses even in its powered run; Lantern still has 9,600
contact-impulse samples when stationary and unpowered, with no resulting
clamp energy loss. Contact impulses are thus not necessary for every guard
event, and contacts alone do not explain Lantern's guards.

This observation does **not** prove that strong actuators are physically
incorrect, nor exclude contact, velocity feedback or pose effects during
powered swimming. Guard classification (linear versus angular) and a coherent
absolute muscle/drag normalization remain unresolved. No demonstrated,
movement-preserving solver replacement followed from this bounded check, so
the existing caps remain protective approximations. Raw controls are retained
in `docs/experiments/guard-causality-v1.json`; the fast suite reproduces
them without altering the live simulation.

### Unpromoted coherent surface and anatomical-strength alternatives

The current calibrated passive-work-v3 coefficients remain intentional
approximations, not an integrated isotropic surface-fluid law or biological
tissue-stress measurement. A bounded offline comparison applied the existing
axial/transverse drag coefficients consistently to rotational resistance,
and separately examined muscle torque proportional to contact cross-section
times an internal lever, normalized against one actual Darter joint. Across
nine frozen swimmers and three conditions, coherent rotational drag reduced
Broadwake travel by up to 32.5%. The reference-normalized anatomical strength
law produced losses up to 98.7% and gains above 215% with additional guards.
These alternatives are **not** new save regimes, options or defaults: they
failed the movement-preservation gate and are not shipped. The current game
retains working calibrated forces until a physically justified replacement can
preserve functional motion across different anatomies. Refer to
`docs/experiments/coherent-fluid-muscle-trial-v1.json` and project status for
the measured rejected candidates; the Wiki describes only the active model.

### Remaining limitations and release checks

The discrete solver uses velocity bias, position projection, limits and contact
impulses, which can alter mechanical energy. Paid actuator work and chemical
closure do not prove full solver-wide conservation or exclude every exploit.
An opt-in offline kinetic observer separates force/motor integration, speed
clamps, anchor impulses, angular limits, contact impulses and pose projection.
Unpowered anchor and angular-limit error controls demonstrate velocity-bias
energy injection. Bounded inelastic contact dissipates energy; projection changes
pose without an immediate kinetic change, which does not exclude later effects.
The passive batch corrects the demonstrated joint kinetic injection for current
worlds; historical regimes retain it for continuation. Speed-clamp dependence,
pose-induced momentum/potential errors, broader contacts and full mechanical
fidelity remain open, as does normal-drag/geometric-muscle replacement.

A two-sided frozen-genome regression gate compares all nine featured designs
against their pre-change movement and total energy expenditure. It catches
large gains as well as losses; known food-acquisition checks remain. Material
measured positive or negative changes must be disclosed to the user **before
production**, even if formula/accounting tests pass. The 10% numeric tripwire is
an additional gate, not permission to ignore other drastic qualitative changes.

## Offline starter development

The bounded search uses the production kernel and existing mutable motor
genes. It keeps anatomy, neural weights, organs, learning traits, lifecycle
genes and normal starting reserves intact, retaining each family separately.
It never supplies scores or target coordinates to a living brain.

The default budget is 25 training evaluations per family: one parent plus
three generations of eight offspring. Six-second food-free trials exclude
one second of startup from COM progress and path measurements. Fitness
combines straightness, sustained late progress and total reserve expenditure;
idle and startup-only movement cannot score.

Promotion uses three nine-second swims at different headings/viscosities
(0.15/0.18/0.22), plus a 15-second swim. Every screen requires at least 5%
more progress, 2% more progress per reserve joule, no lower late speed,
no more than 5% extra expenditure and preservation of the prior route.
Sampled caps, hinge drift, invalid poses, exhaustion and accounting errors
reject a result. Final-tick observations cannot exclude all substep exploits.

Selected alleles apply only to newly constructed CUR-003/008/009 genomes.
Existing saved genes continue unchanged. The method adapts COM/late-motion
evaluation from Karl Sims's *Evolving Virtual Creatures* (1994); efficiency
weighting and promotion guards are VIDA-specific. Stronger empty-water
swimming does not establish mouth-first travel, food capture or fitness.

## Food-oriented starter calibration

New CUR-002 Twin Oar genomes shift the SOUTH paddle phase by half a cycle,
aligning travel with the forward mouth. Balanced mode pairs that timing with
stronger mutable retinal/Angle weights. The live controller still receives
ordinary RGB and body feedback; food locations and audit scores remain offline.
The controlled approach improvement was measured under legacy physics;
scattered-food intake remains seed-dependent. Current physics changes do not
rewrite those inherited genes. Equivalent corrected-world benefits are unproven.

In the forward-mouth model, the finite-food approach check
requires visually caused intake and a net reserve gain after normal costs.
Contact ticks must explain absorbed joules at the existing specialist rate and
assimilation. A successful approach need not consume the entire particle:
aperture orientation and finite contact duration govern how much can enter.
Older saved mouths are automatically converted to fixed diet diameter and forward
reach when loaded; future feeding follows the converted geometry.

## Developer entry points

- `npm run audit:foraging`: Twin Oar finite-food controls and three short scattered-food pairs.
- `npm run audit:foundation`: historical bounded comparison of the three earlier physics regimes.
- `npm run audit:solver`: passive controls, nine frozen swimmers at three conditions and paired short ecosystems.
- `npm run audit:mechanics`: stage-resolved kinetic audit with passive controls and nine frozen swimmers.
- `npm run audit:locomotion`: historical legacy passive drag/spin and scaling checks.
- `npm run search:locomotion -- --check`: reproduce the committed default selection.
- `--id CUR-003`, `--seed`, `--generations` (1–8), `--offspring` (1–16) and `--output report.json`: bounded search options; `--check` requires the default budget/seed.
- Code: `simulation.ts`, `foundationPhysics.ts`, `locomotionSearch.ts`, `locomotionPhysicsAudit.ts`, `starterLocomotion.ts`.
- Checks: `tests/motor-control.test.ts`, `tests/evolvable-actuation.test.ts`, `tests/locomotion-search.test.ts`.
