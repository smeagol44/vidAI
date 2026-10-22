# Prism resistance v4 — issue #61 / draft #79

**Implemented, measured, UNMERGED and UNDEPLOYED. Promotion blocked by material
movement/ecology regressions.** Branch `experiment/prism-resistance-v4` targets
`testing` at d7a6814 independently of unmerged audit #77 and controller #72.
Owner D1/D2 authorize this bounded model experiment, not final coefficients.
No starter, neural weight, motor gain, baseline or safeguard was adjusted.

## Explicit model and save contract

`physicsRegime: prism-resistance-v4` selects a fixed, experimental constitutive
profile. It is never selected by DEFAULT_SETTINGS, NEW_PHYSICS_REGIME, ordinary
reset or an automatic import upgrade. No new UI selector is added. Experimental
worlds are constructed explicitly by the offline comparison and use the real
Worker; this is not published user functionality.

| Reference | v4 value |
| --- | ---: |
| Length | .001 m/px |
| Time | 1 physical s/simulated s |
| Out-of-plane depth | .007 m, fixed for every rectangular part |
| Tissue / water density | 1000 / 1000 kg/m³ |
| Mass unit | .0008575 kg/M |
| Force unit | 8.575e-7 N per M px/s² |
| Inertia unit | 8.575e-10 kg m² per M px² |
| Torque / mechanical work unit | 8.575e-10 N m / J per M px²/s² |
| Stored chemical energy | Existing joules, unchanged |

`V=w*h*d`, `m=rho*V`, `I=m*(w²+h²)/12` in SI, from actual rectangular geometry.
The same mass/inertia underlie force integration, hinge effective mass, contact,
projection, COM and kinetic diagnostics. Valid grid geometries numerically retain
the old area mass above its floor; v4 uses volume without the historical floor.
Old regimes keep their original mass expression, coefficients and arithmetic.
Fixed-depth growth has mass ∝ size² and inertia ∝ size⁴, not 3D similarity.

Schema **17.0.0** strictly requires this regime. v3–v15 reject a smuggled v4;
v17 rejects an old regime. Independent #72's schema 16 is deliberately unsupported
here: no experimental controller genes or semantic changes were imported.
Historical snapshots retain exact continuation. A deliberate experimental copy
changes the schema/regime only; it does not rescale chemical stocks, construction,
food, eggs, reserves, inherited gains or learned state. Exports remain unsupported
in the deployed app, which correctly rejects the new schema.

The historical mechanical multiplier is 1.75e-7 J/unit. v4's multiplier is
**204.0816× smaller**. The kernel passes it into shared prepaid work, and all
kinetic/contact diagnostics use the same reference. The old constant/default
remains untouched for v0–v3. At identical simulated impulses/velocities the v4
chemical bill is therefore 204.0816× smaller; this is an explicit consequence of
the adopted mechanical reference, not a demonstrated efficiency improvement.
Chemical stocks/costs were deliberately held fixed for this comparison, are still
empirical biology, and cannot be called physically calibrated physiology.

## Fixed provisional resistance profile

`prismPhysics.ts` freezes **eta=.001 Pa s**, **water rho=1000 kg/m³**, **Cd=1** and
shear length **ell=min(w,h,d)**. These are the *first experimental assumptions*,
not approved final coefficients or a fit to swimming. Cd=1 is a nominal pressure
coefficient, not transferred from Sims or validated rectangular-prism data. The
legacy numeric `waterViscosity` is not reinterpreted: v4 uses this fixed SI profile
for organisms. Thus equal legacy slider values do not establish equal physical
fluid conditions across models. Source geometry, seeds, headings and chemical
conditions are matched; the changed constitutive law is the treatment.

At every surface point, `v_point=v_COM+omega cross r`. Linear traction is
`dF_visc=-eta/ell*v_point*dA` on **all six faces**, including tangential shear on
both broad faces. It is a local friction closure, not a solved Newtonian velocity
gradient or finite-prism Stokes solution. Its translation and spin are integrated
from the same traction: `F=-gamma*S*v_COM`, `tau=-gamma*integral(r_xy²*dA)*omega`.
No unrelated rotational gain or 1/40 axial calibration is added.

Pressure traction acts only on leading normal surface elements:

```
vn = dot(v_point,n)
dF_pressure = -.5*rho*Cd*max(vn,0)^2*n*dA
```

Opposite face pairs count projected area **once**. Normal velocity varies along
an edge during rotation. Split its linear velocity at zero and use two-point
Gauss integration on each polynomial interval, exact for the quadratic force,
cubic moment and dissipation potential up to roundoff. Force and `r cross dF`
therefore remain consistent for rotation, combined motion and all aspect ratios.
Broad faces have zero normal speed in planar motion but still supply viscous
shear. Connected/covered faces are counted; hydrodynamic shielding is absent.

Point power is `-gamma*|v_point|²` for viscosity and
`-.5*rho*Cd*max(vn,0)^3` for pressure, both nonpositive. No imposed propulsion,
position steering, guaranteed gait, prescribed fitness or neural input is added.

## Integration, impulses and work

Each authoritative 1/60 s tick retains four substeps (more if dt requires it).
Only v4 changes the force ordering:

1. Original inherited six-output servo computes bounded equal/opposite joint
   torques from the common starting velocities; all gains, oscillator and learning
   semantics remain. Inertia-based strength is provisional, not #60 anatomy.
2. Prepay positive joint work against the combined simultaneous motor/wall/gravity
   velocity increment. Braking is separate and cannot fund another joint or
   regenerate reserve. Short reserves scale torques before they act.
3. Apply those impulses, then solve local viscous/pressure drag by **backward
   Euler** for each part, using the fixed substep pose. The 3×3 resistance Jacobian
   is positive definite after adding body mass/inertia; Newton with convex line
   search stops by a velocity residual. Nonconvergence throws, never silently
   changes coefficients or continues invalid motion.
4. Keep the same 400 px/s and 20 rad/s guards, passive complete joint batch,
   position advancement and contact/projection sequence. No safeguards weakened.

There is no actuator work during the drag-only split. Paid motor work is measured
on the motor impulse path; drag removes kinetic energy afterward. This is a
**first-order split**, not exact coupled continuous dynamics. Backward Euler gives

```
K_before - K_after = dt * R(v_after) dot v_after
                  + .5 * deltaVelocity^T * massMatrix * deltaVelocity
```

The first term is endpoint traction dissipation; the second is numerical damping,
reported separately. Neither is billed again to chemical reserves. The chemical
ledger's historical `mechanicalWorkHeat` name denotes total motor debit, not an
instantaneous full thermodynamic heat stock. No added-fluid kinetic energy exists.

Frozen scalar receipts observe requested/applied torque, ceilings, prepaid work,
guards, incoming overspeed, accepted-constraint velocities, post-contact substep
joint errors, fluid work, numerical loss and Newton convergence. They never enter
saves, genomes, brains or solver decisions. `maxForceOmega` is a peak **among guard
receipts**, not every pre-fluid velocity; constraint/substep peaks cover all parts.
The paused `physics-experiment-step` command accepts 1–3600 fixed ticks, with
strict v3/v4, running-state, epoch and boolean-observation gates.

## Corrected actual-Worker comparison

Valid raw evidence: [prism-worker-v4.json](prism-worker-v4.json), Worker asset
`simulation.worker-G60xvNWQ.js` for the measured source. The adapter resolves the
Worker **referenced by the built application**, never the first stale hash in dist.

All **27 five-second v3 reference swims** match archived travel, expenditure,
guards, limited batches and tick joint errors **exactly**. Nine frozen families
use the three original heading/legacy-viscosity pairs, seed 711, normal reserves,
no food/inflow and unchanged inherited neural heads. Each starts from the same
snapshot for v3/v4; there is no fresh-head initialization confound. All physical
observations are from the actual Vite-built browser Worker in a real thread.

| Frozen body | v3 median travel px | v4 median travel px | Paired travel change range | Guards across three conditions |
| --- | ---: | ---: | ---: | ---: |
| CUR-001 | 190.50 | 90.34 | -59.02% to -45.50% | 0 → 0 |
| CUR-002 | 39.05 | 15.85 | -65.53% to -52.68% | 0 → 0 |
| CUR-003 | 40.97 | 37.00 | -19.50% to +2.80% | 0 → 0 |
| CUR-004 | 31.15 | 27.46 | -38.75% to +23.31% | 996 → 741 |
| CUR-005 | 81.10 | 28.11 | -66.44% to -63.99% | 328 → 0 |
| CUR-006 | 20.71 | 25.52 | +21.46% to +75.62% | 3302 → 2652 |
| CUR-007 | 29.49 | 47.31 | +40.45% to +78.08% | 0 → 0 |
| CUR-008 | 88.99 | 26.30 | -73.17% to -67.27% | 0 → 0 |
| CUR-009 | 64.70 | 53.62 | -17.38% to -16.08% | 0 → 0 |

**25/27** pairs exceed the unchanged two-sided 10% movement tripwire. Median paired
travel change is **−19.50%**, range **−73.17% to +78.08%**. Both gains and losses
block automatic promotion. New movement is useful in some anatomies, but neither
shape-independent locomotion nor controller superiority is established.

Across isolated swims, motor positive work is **57.9381 → .232267 J**, braking
**22.3437 → .080637 J**, chemical motor debit **231.752 → .929069 J**. Most of that
numerical contrast reflects the unit rebase; in the old mechanical-unit reference,
v4 positive work would be 47.4015 J (18.2% below v3), not a 249× biological gain.
Median total reserve expenditure changes by **−3.39%**, since unchanged metabolic
costs dominate. All **133,200** candidate joint requests are delivered exactly;
no energy limiting occurs. Candidate near-ceiling samples: 82 versus v3's 1156.
These existing servo-head results do not select an anatomical strength law.

Isolated guards decrease **4626 → 3393**, all angular. Accepted joint-batch
overspeed crossings decrease **23 → 0** in this sample. Post-solve peak angular
speed decreases **21.078 → 17.024 rad/s**, substep anchor error **.12955 → .06500 px**,
limit excess **.02541 → .000471 rad**. Maximum accepted constraint gain is
2.71e-20 J (roundoff). These positive results do not erase earlier #72 findings.

Candidate isolated fluid endpoint dissipation is **.0720373 J**, additional BE
numerical loss **.00117051 J** (1.62% of that physical term). Maximum per-substep
fluid energy identity residual is **5.09e-15 J**, and at most three Newton iterations
are used in these swims. This supports measured numerical behavior, not a general
error bound or proof of accurate hydrodynamics.

## Ecology and performance — material negative outcomes

Two original closed-economy 60-second showcase seeds are compared, with capsule
mouths, normal reserves, untouched genomes and no assistance. V3 rounded census,
actual intake and guards exactly match the archived solver report in both seeds.

| Seed | Nutrient intake J, v3 → v4 | Eggs laid, v3 → v4 | Living at 60 s, v3 → v4 |
| --- | ---: | ---: | ---: |
| 17 | 58992 → 10488 (−82.2%) | 1 → 0 | 10 → 9 |
| 73 | 97872 → 46848 (−52.1%) | 3 → 2 | 12 → 11 |

Neither model eats prey/carrion/eggs in these short pairs. V4 chemical motor debit
is 3.045/3.118 J versus 740.171/732.982 J, yet feeding and reproduction still
regress. Lower motor billing does not establish viable ecology. No sustained
survival, evolutionary discovery or new training claim follows.

Candidate ecological guards remain **6914/5413**, all angular. Joint-batch peaks
are 19.265/19.698 rad/s with zero joint-created crossings, yet **post-contact peaks
reach 29.079/29.639 rad/s**. Only contact impulses change angular velocity between
those observations; the contact stage can redistribute velocity above the guard.
This is not a solved speed-bound problem: #72's measured constraint redistribution
and this experiment's contact redistribution remain explicit open findings.
Maximum chemical discrepancy across the valid swims/ecologies is 2.25e-8 J.

The established performance workload uses 15 creatures, 78 nutrients and 221
remains, its same inherited-mask path, 10 warmup plus 120 measured ticks, and two
rounds in reversed order. Observers are disabled. Actual Worker timings:
**312.93 → 415.76 ms (+32.86%)**, **296.94 → 407.25 ms (+37.15%)**.
This includes the same trial census overhead in both regimes and trajectory/contact
divergence; it is not an isolated drag microbenchmark or browser FPS. O(parts)
local work does not guarantee negligible cost or the 1000-part performance target.

## Excluded development runs and verification

The first run missed the new work factor at one motor-batch call site. It is
retained as [excluded-work-factor](prism-worker-v4-excluded-work-factor.json).
A rerun then selected that stale built Worker via the old first-hash adapter;
retained as [excluded-stale-bundle](prism-worker-v4-excluded-stale-bundle.json).
**Neither is evidence for the corrected candidate.** No coefficient was changed
between those runs; a kernel work test first reproduced the factor error and
then passed after fixing the call. The actual Worker/host snapshot comparison
caught the stale asset. Only that demonstrated error justified repeating affected
trials. Baselines and the #72/#77 artifacts were never overwritten.

- **288/288 fast tests** (280 testing-base +8 new), testing metadata, build and
  both actual built-Worker checks pass locally. New checks cover independent
  six-face numerical integration, pure translation/spin, large-step passivity,
  analytic convergence, SI impulse/work, kernel payment including tiny reserves,
  old/new schema rejection and exact continuation across contact/ecology choices.
- Observed/unobserved actual Worker snapshots/PRNG match the direct authoritative
  host exactly; exported Worker snapshots reset/fork/continue exactly.
- Existing historical-save, frozen movement/energy/stability/ecology gates remain
  intact. Candidate movement failures are disclosed, not substituted into goldens.
- The proven exact testing-build identity assertion from #72 is reused for the
  existing CI smoke. No controller implementation is imported; no manual browser
  campaign is performed. CI/check conclusions are recorded in #79/#57.

## Limitations and exact next action

No fluid field, added mass, wake, shielding, circulation, lift-memory, jets, free
surface or out-of-plane motion. This is not creeping-flow validity at moderate Re,
not resolved inertial fish swimming, and not validated Cd/shear-length data.
Part overlap/covered surfaces and physical tissue anatomy remain approximate.
The comparisons use gravity zero. Buoyancy is not newly enabled; nonzero gravity
and existing food/egg particle motion retain their historical empirical rules,
not a complete SI fluid-particle model. Legacy UI viscosity still belongs to
those historical rules, not the fixed v4 organism profile. No deployment/UI claim.

Work efficiency remains 25%; isometric/activation/braking/maintenance costs,
force-speed limits, reserve mass and tissue allocation remain #60 decisions.
Existing inertia-based torque is dimensionally expressible but not anatomical.
Fixed-depth anatomical section×lever scaling differs from inertia scaling; do
not change gains to compensate for the measured gait losses. No evolutionary
search was run and no user decision is inferred about final parameters.

**Promotion blocked.** Preserve the candidate and all valid/excluded evidence.
The next bounded diagnostic is a held-command, fixed-neural-cadence timestep
comparison to separate split/integration error from constitutive gait changes,
with motor work and contact overspeed still observed. Do not double the neural
update rate and call it a physics-only timestep test. Review those results and
the provisional drag assumptions before any coefficient or #60 anatomical-cost
selection; no sweep to recover a particular founder. No merge, default, production,
testing deployment, actual Wiki update or release is authorized by passing CI.

## Reproduce and scientific context

```
npm run test:fast
npm run build
npm run test:worker
npm run test:prism-worker
npm run experiment:prism
```

The last command performs the 54 swim trials, four short ecosystems and four
performance rows only; it does not train/evolve organisms. Timings vary; archived
v3 physical/census comparisons are exact and checked. Original solver baseline
SHA-256 is checked before/after. Scientific background and dimensional derivation
remain in [audit #77](https://github.com/smeagol44/vidAI/pull/77):
[Sims 1994, section 4](https://www.karlsims.com/papers/siggraph94.pdf),
[Lauga/Powers 2009](https://www.damtp.cam.ac.uk/user/lauga/papers/32.pdf),
[Eloy/Michelin](https://arxiv.org/abs/2409.20162),
[NASA area/Cd conventions](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-coefficient/),
[NIST viscosity](https://www.nist.gov/system/files/documents/srd/jpcrd382009101p.pdf).
They motivate distinctions and approximations; none supplies VIDA's final profile.

## Subsequent bounded numerical diagnostic

See [integration resolution and splitting checkpoint](prism-integration-v1.md).
All nine three-body/method combinations failed the capped convergence gates;
no correction, promotion or replacement of the original evidence was selected.
