# Physical reference audit — #61

**Status: offline audit implemented; dimensional/fluid proposal UNAPPROVED.**
Branch `audit/physical-reference-61`, based on testing `d7a6814`; target testing.
No runtime, controller, geometry, coefficient, safeguard, save schema or Wiki
change. This report does not establish a replacement physical law or swimming.

## Evidence and scope

Sources inspected: `simulation.ts`, `foundationPhysics.ts`, contacts, joint
passivity, persistence/energy economy, SimulationHost and built Worker; current
Motor-Control documentation; rejected #52 evidence; frozen movement, energy,
stability and ecology tests. All nine frozen CUR bodies (46 parts) are inspected
statically, without mutation or search. Machine-readable output:
[physical-reference-v1.json](physical-reference-v1.json).

The completed [#72 causal audit](https://github.com/smeagol44/vidAI/blob/73f73981b61f37db6a439e5802e11ff7d5efe44f/docs/experiments/torque-demand-audit.md)
and raw files remain on their original branch, unchanged. Its 115,200 gated
requests were fully delivered with no reserve limiting or saturation. Fresh
legacy-head initialization alone reduced travel by a median 91.05%. Different
body plans have different demand ratios. These findings reject a demonstrated
universal strength shortage; they do not identify a correct fluid model.
The audit's browser run 39827626399 was **cancelled**, not passed. Its 300 fast
tests, build and actual Worker checks passed. No repeat of those 54 trials,
the evolutionary search or ecological comparison is needed for this static audit.

## Currently implemented assumptions

| Quantity | Current rule | Assessment |
| --- | --- | --- |
| Length/time | Geometry in px; 7 px grid; fixed 1/60 simulated second tick, four 1/240 substeps | Coherent numerical coordinates; wall-clock playback speed is not physical time |
| Mass | `max(.35, .40*dimN*dimM)` M | Area-proportional above floor; not volumetric tissue density. The 46 inspected parts never use the floor |
| Inertia | `m*(w²+h²)/12` | Exact in-plane polar inertia of a uniform rectangular lamina/prism; no separately modelled water inertia |
| Fluid | Local, memoryless, linear resistance at each part; stationary background | Empirical generalized resistance; no fluid momentum field |
| Gravity | `mass*gravity` with default gravity zero | No displaced-water/buoyancy force, free surface, hydrostatic pressure or vertical depth dynamics |
| Motor | Equal/opposite torques; servo stiffness and ceiling proportional to mean part inertia | Dimensionally expressible with rate constants, not anatomical strength |
| Energy | 1 mechanical M px²/s² = 1.75e-7 J; positive work prepaid at 25% efficiency; negative work not regenerated | Consistent accounting conversion and funding; efficiency and biology remain empirical |
| Chemistry | Stored/reserve/food/body energy in labelled joules; body construction, capacity and upkeep formulas | Closed chemical stock bookkeeping; does not validate energy density of tissue or full mechanical/thermal closure |
| Integration | Force velocity increment, 400 px/s and 20 rad/s guards, joint solve, contact/pose corrections | Protective approximations, not physical terminal speeds |

`surface-work-v1` retains uniform four-face resistance, geometric muscles and
sequential paid impulses for historical continuation only. v0/v2/v3 retain the
calibrated drag; v2/v3 prepay coupled work, v3 bounds accepted joint-batch kinetic
gain. None simulates wakes, shielding or deformable bells. Connected faces are
not removed from the older surface calculation. Historical regimes stay exact.

## Dimensional reference: what follows and what does not

Let L metres/px, T physical seconds/simulated second and M kilograms/mass unit.
Every mechanical quantity follows from these independent choices. Angles are
radians (dimensionless). The offline `unitFactors` evaluates these exponents
including non-unit T; no live setting reads it.

| Quantity | SI multiplier per simulation unit | Current comment reference |
| --- | --- | ---: |
| Length | L | .001 m |
| Time | T | 1 s |
| Mass | M | .175 kg |
| Area / volume | L² / L³ | 1e-6 m² / 1e-9 m³ |
| Areal / volumetric density | M/L² / M/L³ | 175000 kg/m² / 1.75e8 kg/m³ per corresponding unit |
| Velocity / angular velocity | L/T / 1/T | .001 m/s / 1 rad/s |
| Inertia | ML² | 1.75e-7 kg m² |
| Momentum / angular momentum | ML/T / ML²/T | 1.75e-4 kg m/s / 1.75e-7 kg m²/s |
| Force | ML/T² | 1.75e-4 N |
| Torque / mechanical work | ML²/T² | 1.75e-7 N m / J |
| Power | ML²/T³ | 1.75e-7 W |
| Dynamic viscosity / normal traction per speed | M/(LT) / M/(L²T) | 175 Pa s / 175000 kg/(m² s) |
| Stored chemical energy | Already labelled J, independently of M/L | Not inferred from mechanics |

The work factor fixes **ML²/T²**, not three independent base units or depth.
With the code comment's L=.001, M=.175, T=1, areal mass density is
`.40/49 * M/L² = 1428.57 kg/m²`. At 1000 kg/m³ this requires **1.42857 m depth**,
whereas inspected part widths/heights are 7–42 mm. Thus the comment is an
arithmetically valid but biologically implausible thin-body water interpretation.
It is not a proven density law. The mass floor also breaks constant areal density
for sufficiently small/nonstandard parts and must remain explicit in old saves.

The `waterViscosity` parameter can be assigned effective dynamic-viscosity
dimensions because resistance is parameter × length × velocity. Under the
comment reference .18 would mean **31.5 Pa s**, not ordinary water. Alternatively
it can represent depth × a surface traction coefficient. That interpretation
requires depth and an explicit shear length: gamma=eta/ell. Newtonian viscosity
multiplies a velocity **gradient**, not velocity alone. Dimensions cannot determine
ell or validate a rectangular surface approximation. The UI parameter therefore
has no established conversion to measured water viscosity.

Pure relabelling of all units leaves trajectories and guard counts unchanged.
Changing the mechanical-J multiplier while retaining chemical stocks/upkeep
changes funding and ecology; it is a physical/economic change, not a free fix.
Do not rescale historical chemical reserves or infer real caloric tissue density
from ledger closure. Keep current save meanings and a separately versioned future
reference; no import-time reinterpretation of genes, learned state or settings.

## 2D representation proposal and alternatives — owner decision D1

**Recommend for the first bounded reference experiment:** uniform rectangular
prisms with a fixed common out-of-plane depth, motion constrained to a plane;
L=1 mm/px, T=1 s/s, nominal tissue/fluid density 1000 kg/m³ and depth **7 mm**.
These are explicit proposed reference conventions, not measured organism anatomy
or a claim that 7 mm is uniquely correct. Seven mm is one existing geometry cell.
Keep gravity disabled; near-neutral density is a mass reference, not an enabled
buoyancy model. Water properties must later name temperature/composition; rounded
eta=.001 Pa s is an illustrative fresh-water value, not a new runtime coefficient.

Then `volume=w*h*d`, `mass=rho_body*volume`, displaced volume is the same prism,
and `I=m*(w²+h²)/12`. Above the floor, matching current area mass requires
**M=.0008575 kg**, yielding **8.575e-10 J** per mechanical unit, a factor
**204.08 smaller** than the old factor. The report computes this as an
**unapproved example**, never writes it to settings. No promise follows about
energy expenditure, survival, muscle strength or swimming under that rebase.

| Representation | Size law for uniform in-plane scale s | Trade-off |
| --- | --- | --- |
| Fixed depth (recommended first reference) | mass s², inertia s⁴, anatomical section×lever torque s² at fixed stress/allocation | Simple plane/prism interpretation; growing bodies become relatively flatter, so not geometrically similar 3D animals |
| Depth proportional to body thickness / inherited depth | mass s³, inertia s⁵, section×lever torque s³ under full geometric similarity | More anatomical; requires new volume/mass/energy/genetic rules and save version, cannot use one old area-mass multiplier |
| Abstract 2D sheet with areal density | mass s², inertia s⁴ | Cheapest; valid mathematical model but displaced volume, physical water regime and biological stresses remain underdetermined |

Normal in-plane projected areas of the prism are h*d and w*d. The two broad
w*h faces have out-of-plane normals and give no in-plane **normal** resistance;
their tangential shear is not zero in a real fluid. All wetted areas, including
these broad faces, must be accounted for by a justified shear/drag model, or their
omission stated. Counting opposite faces versus projected area changes coefficient
normalization; importing a published Cd without its area convention double counts.
Joints/overlap, covered surfaces and hydrodynamic interaction remain approximations.

## Translation, rotation and work: analytic audit

For local COM velocities u,v and spin omega, normal face velocity at r is
`(v_COM + omega cross r) dot n`. With positive linear traction coefficients
gamma_x,gamma_y and depth d, integrating the same force and its moment gives

```
Fx = -2*gamma_x*h*d*u
Fy = -2*gamma_y*w*d*v
tau = -d*(gamma_y*w^3 + gamma_x*h^3)*omega/6
P = Fx*u + Fy*v + tau*omega <= 0
```

Symmetric full faces cancel translation/rotation cross terms. This is an exact
integral of an assumed local traction, **not** an exact Stokes solution for a
finite prism. In the existing translation, `gamma_x*d=.025*mu` and
`gamma_y*d=mu`. Matching those weights in spin would give
`mu*(w³+.025*h³)/6`, versus the current `mu*(w³+h³)/6`.
The extra `.975*mu*h³/6` is positive independent spin damping. Thus current
resistance is mathematically dissipative and could be an empirical resistance
matrix, but its spin cannot be claimed to follow solely from its stated normal
translation weights. The largest ratio among the 46 parts is **16.7164**; the
effect depends on aspect ratio. This is a confirmed derivation mismatch, not
proof the excess spin damping caused #72's regressions. Changing it reproduces
a known rejected direction: #52's coherent-spin trial lost up to 32.5% travel.

Offline checks independently integrate face force/moments numerically over square,
long and tall rectangles and reconcile power. They also check SI impulse/work/
power identities and diagnostic snapshot/PRNG invariance for the representative
Darter, Twin Oar and Branchstalker. They do not choose new traction coefficients.

## Fluid regime proposal — owner decision D2

Sims [1, section 4] used area × normal-speed linear resistance and omitted fluid
motion. It motivates an inexpensive approximation, not VIDA's coefficient values,
units or biological validation. His offline fitness selection is not a proposed
live-ecosystem rule.

For a specified fluid, assess both `Re=rho*U*l/eta` and the oscillatory inertia
ratio `rho*Omega*l²/eta`. COM speed alone is insufficient; rotating paddle tips,
stroke frequency and part/body lengths matter. **Illustrations, not measured
regime claims:** a 35 px part at 50 px/s and 1 Hz in rounded water gives:

| Length reference | Re | Oscillatory ratio |
| --- | ---: | ---: |
| 1 micrometre/px | .00175 | .00770 |
| 1 millimetre/px | 1750 | 7696.90 |

Low-Re/quasi-static resistance needs both ratios small [2]. Nonreciprocal shape
cycles can swim; a reciprocal one-degree-of-freedom stroke cannot in the ideal
inertia-free setting. Retaining substantial body inertia, guards or solver errors
does not make that a true creeping-flow simulation. Slender-body resistance
coefficients do not automatically apply to VIDA's broad/branched rectangles.

| Option | What it represents / omissions | Expected computational cost |
| --- | --- | --- |
| A: creeping-flow mobility/resistance | Appropriate to tiny/slow organisms or very viscous fluid; quasistatic force/torque balance. Local resistance omits long-range interactions; coupled Stokes mobility is more complete | Local O(parts) assembly plus constraint/mobility solve; dense interactions O(parts²) storage/assembly and typically O(parts³) direct solve unless accelerated |
| B: finite-body-inertia, quasi-steady viscous + pressure resistance (**recommended first testing approximation**) | Normal and tangential resistance using local relative point velocity; pressure scale `.5*rho*Cd*abs(vn)*vn`, plus justified low-speed viscous resistance. No resolved fluid momentum, added mass, wakes, lift circulation, jets or drafting | Fixed quadrature/analytic face integrals O(parts) per substep, no water grid; modest multiplier over current local formulas, unbenchmarked |
| C: reactive fluid inertia plus resistance | Added fluid mass/momentum and configuration-dependent coupling; eventually wakes for lift/interaction. More faithful for vigorous articulated swimming [3,4] | Local added-mass assembly may be O(parts), but constraint/effective-mass solve and energy coupling change; wake interactions often O(elements²) without acceleration; grid solvers also scale with fluid resolution and timestep |

**Recommendation:** B with D1's millimetre prisms for the next explicitly labelled
economical approximation, if the owner accepts that limitation. It is a reference
for resistive articulated swimmers, **not** a physically complete moderate/high-Re
fish model. At large oscillatory inertia, omitted reactive forces can dominate;
if realistic inertial fish swimming is required now, select C and budget the added
mass/solver work instead. Lighthill assumes elongated bodies: directly applying
its coefficients to broad branched VIDA animals is unjustified. A needs a different
scale/time or viscosity choice and likely a different integration formulation.
No option guarantees locomotion for every body or stroke.

For B, derive force and torque from the **same** local traction and integrate
`r cross dF`; never add unrelated spin coefficients to regain movement. A candidate
normal law `dF=-(gamma*vn + .5*rho*Cd*abs(vn)*vn)*n*dA` is dissipative for
nonnegative coefficients because its point power is
`-gamma*vn² - .5*rho*Cd*abs(vn)^3`. Tangential shear needs its own positive,
geometry-dependent closure. This expression defines a candidate approximation,
not selected coefficients or a CFD solution. It must document exposed/projected
area, density, shear length, Reynolds dependence, validity range and omissions.
Adding linear and quadratic terms alone does not solve fluid inertia or establish
an accurate crossover law; reference drag/rotation evidence is required [5].

## Stability, safeguards and chemical energy

For isolated linear drag, explicit velocity integration multiplies speed by
`1-a`, where `a=c*dt/m` (or c*dt/I for spin). Energy is nonincreasing for
0<=a<=2; monotone velocity decay requires a<=1. At mu=.18, the 46 current parts'
largest a is **.02625**. The earlier representative three-condition audit's .0321
maximum includes mu=.22. Neither check establishes coupled-solver fidelity.
Actual water/microscale parameters can have far shorter relaxation times; changing
units cannot cure a stiff explicit scheme. Exact/implicit drag or an overdamped
solve must be assessed after model choice, including simultaneous motor work.

Keep all prior #72 findings open: 8,915 angular guards; 1,318 accepted constraint
crossings of the individual 20 rad/s guard with peak 25.63 rad/s despite batch
kinetic passivity; a .568 px substep hinge error versus .433 px tick sampling.
Guard-before-constraint ordering does not enforce a final speed bound. Contacts,
wall springs/damping, pose repair and momentum fidelity need separate checks.
Do not remove caps, add smoothing/dwell, alter baselines or call guards drag.

Prepaid positive actuator work and chemical efficiency remain required. Distinguish
actuator work, negative work/braking, body kinetic energy, fluid dissipation,
constraint/contact/guard changes and any fluid kinetic storage. Current chemical
closure does not include those mechanical stocks. Added mass cannot be installed
as a drag force: fluid kinetic energy and changed effective inertia must enter
work and constraints consistently. Isometric activation, maintenance, shortening
speed and braking heat remain #60 decisions; 25% is not a universal muscle law.

## Consequences for #60 and #59

Choose depth/density/length/time and regime before converting tissue stress into
joint torque. Muscle cross-section is m², stress N/m², lever m, hence torque N m;
allocate finite inherited muscle volume/mass rather than infer capacity from I.
At fixed depth, section×lever scales s² while current torque scales s⁴. At full
3D similarity they scale s³ and s⁵ respectively. The difference cannot be removed
by one strength multiplier across aspect ratios. Define attachment/lever geometry,
allocation, force-speed, activation/maintenance and reserve funding in a separate
#60 experiment. Existing constructor costs/capacities are empirical and need an
explicit tissue/chemical-energy decision before being called physical anatomy.

#72 proves no binding capacity shortage in its trials. Do not enlarge muscles
to compensate for fresh heads. Preserve independent signed torque and a
policy-comparable legacy control when evaluating a new law. Separate numerical
constraint redistribution from muscle/drag causes; both must remain visible.

## Validation and exact continuation

Run `npm run audit:physical-reference` to regenerate **only this static report**;
byte-identical regeneration is expected. `npm run test:fast` includes the new
dimensional/face/invariance tests and the existing frozen movement, stability,
energy, ecology and historical-save checks. `npm run build` and
`npm run test:worker` protect actual built Worker authority/integration. No UI
code changed, so no browser campaign is required for this offline module.
Results and remote CI are recorded in the PR and #57, not inferred from this text.

**Exact next action:** obtain D1 (fixed-depth millimetre prisms, variable-depth
physical bodies, or abstract sheet) and D2 (B economical resistance, A microscale
quasistatic, or C reactive fluid inertia). Then open a separate versioned
testing-only implementation with named constitutive parameters and a units/save
contract. First test free translation/spin, rotated/aspect-ratio bodies, passive
dissipation, impulse/work and coupled constraints at multiple timesteps. Only
then compare unchanged frozen movement/energy/stability/ecology baselines; report
both regressions and gains before considering promotion. No model decision,
merge, release, deployment or Wiki publication is authorized by this audit.

## Scientific references (primary sources)

1. Karl Sims (1994), *Evolving Virtual Creatures*, SIGGRAPH, section 4,
   [author PDF](https://www.karlsims.com/papers/siggraph94.pdf), DOI 10.1145/192161.192167.
2. Eric Lauga and Thomas R. Powers (2009), *The hydrodynamics of swimming
   microorganisms*, Reports on Progress in Physics 72 096601, sections 3–5,
   [author PDF](https://www.damtp.cam.ac.uk/user/lauga/papers/32.pdf), DOI 10.1088/0034-4885/72/9/096601.
3. M. J. Lighthill (1971), *Large-amplitude elongated-body theory of fish
   locomotion*, Proceedings of the Royal Society B 179 125–138,
   [DOI](https://doi.org/10.1098/rspb.1971.0085). Publisher PDF retrieval failed;
   interpretation here is cross-checked against the authors' accessible study [4].
4. Christophe Eloy and Sébastien Michelin (2024 preprint), *Flow associated with
   Lighthill's elongated-body theory*, [authors' manuscript](https://arxiv.org/abs/2409.20162).
   Separates resistive force from the reaction to accelerating added water mass.
5. NASA Glenn, [Drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
   and [Drag coefficient](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-coefficient/).
   Equation/area/Reynolds conventions only; aircraft Cd values are not water-prism data.
6. M. L. Huber et al. (2009), *New International Formulation for the Viscosity of
   H2O*, J. Phys. Chem. Ref. Data 38 101,
   [NIST PDF](https://www.nist.gov/system/files/documents/srd/jpcrd382009101p.pdf).
   Supports the approximate water-viscosity scale; does not determine VIDA drag.
