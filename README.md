# VIDA / vidAI

An aquatic artificial life simulator with articulated 2D bodies, physical swimming,
recurrent neural controllers, mouth-specific feeding, inherited mutations and eggs.
Developed directly in this repository. The standalone build preserves the established
VIDA interface and validated energy-accounting fixes. No Playground dependency is used.

By Hernán Garro & Federico Regueira.

**Play:** https://smeagol44.github.io/vidAI/

## Development

Use Node.js 24 LTS (minimum 22.12).

```sh
npm ci
npm run dev
```

Open the printed URL ending in `/vidAI/`. No API keys, Google account, backend,
or Playground SDK are required. Dependencies, CSS, images and audio are bundled
locally into the build. Exported Playground configuration values are retained.

```sh
npm run test:fast    # routine automated regressions, no long ecosystem runs
npm test             # optional full simulation suite
npm run build        # TypeScript checks and production build
npx playwright install --with-deps chromium
npm run test:e2e     # optional browser suite at the Pages subpath
npm run preview      # serve dist locally after building
npm run benchmark -- --seed 4242 --seconds 300
npm run benchmark:behavior # controlled motion and paired vision measurements
npm run benchmark:ecology  # read-only fixed-seed ecological validation JSON
```

## B-D ecological validation (bounded prototype)

The B-A–B-D movement/behavior/measurement workstream is now complete as a
**measurable prototype**, not a self-sustaining ecosystem. Three brief
unassisted seed worlds with scattered nutrients produced **zero feeding**
despite 12 surviving starter creatures. Controlled sighted Darters absorbed
816–1,680 J of finite food in eight short tests while retinally
disconnected controls absorbed none. Separately, three explicitly
pre-funded adult setups laid viable-energy eggs; three deliberately
low-reserve setups died and conserved carrion. These controlled outcomes
do **not** establish natural multigeneration survival, reliably tracking
hunters or general evolved fitness. Run `npm run benchmark:ecology` for
the reproducible seeded JSON report and see
[Ecology Baseline and Energy Auditing](https://github.com/smeagol44/vidAI/wiki/Ecology-Baseline)
for methods and limits. **Original Phase 5 lifetime synaptic learning**
and **original Phase 6 optional sleep/replay** are still pending.

## Waking lifetime learning (original Phase 5, bounded core complete)

Descendants can now *evolve the capacity to learn while alive*.
A rare inherited plasticity gene enables short-term eligibility
traces and reward-modulated changes to an individual's Angle-motor
synapse weights after actual mouth intake; a second inherited trait
determines forgetting. These acquired changes are **not** copied to
offspring, do not alter genomic neural weights, cost finite metabolic
energy, and are saved exactly. The Brain inspector visualizes effective
inherited-plus-learned motor synapses.

In a controlled experiment with real plant-food contact and **no
physical motor force**, the same learned Angle response increased
from about **0.642 to 0.691** while the unfed control stayed
about **0.642**. This establishes conditioned neural changes inside
a lifetime, **not proven better swimming or food acquisition**.
A later full-physics experiment compares creatures keeping
or erasing personal acquired memories after the same
real food patch. Of four short second-food encounters,
one learned animal absorbed **180 more gross J**,
one **420 fewer J**, and two tied. This is possible
physical learned benefit, not reliable generalization.
The core implementation is complete; sleeping/replay
(original Phase 6) is not implemented. See [Waking Synaptic Learning](https://github.com/smeagol44/vidAI/wiki/Waking-Learning).

### Expanded Phase 5 capabilities (v0.22)

Descendants may now inherit the ability to learn on **every existing
joint's six motor commands**, rather than Angle alone, while keeping
the 96-edge limit and real energy cost. A second optional gene
uses only **physical predator bites** as negative reinforcement,
alongside positive real-food absorption. Neither is a hardcoded
escape or chasing reflex. Earlier creatures retain their exact
Angle-only behavior and acquired experiences still cannot
pass to offspring. These systems are functional but are not
yet proof of improved lifetime food acquisition or survival;
see the [Waking Learning Wiki](https://github.com/smeagol44/vidAI/wiki/Waking-Learning).

### Learned retinal contexts (v0.23)

Creatures may now evolve an individual **visual memory**:
real RGB rays can acquire and retain changed retina-to-hidden
connections following actual compatible-mouth feeding or
real predator bites. The resulting sensory adjustment affects
future neural and motor output; it costs finite energy,
forgets gradually and is saved without being passed to offspring.
A small controlled physical feeding check demonstrated that
acquired retinal connections causally changed a later neural
response. General food classification, robust foraging and
survival benefits remain unproven. See
[Waking Synaptic Learning](https://github.com/smeagol44/vidAI/wiki/Waking-Learning).

### Selective lifelong retention (v0.24)

A rare new inherited allele permits animals to **keep useful
personal learning longer**. Existing learned retinal and
motor connections consolidate only after additional
consistent real-feeding or injury feedback. Conflicting
experience weakens consolidation; both the memory and
its maintenance cost remain individual and finite.
After four food-free seconds, a controlled learner
retained about **47% more acquired synaptic weight**
than a matched clone without protection. This
does not yet prove better acquired foraging or survival.
Original Phase 5's physical test found both a
helpful and a harmful learned feeding outcome.
Its core waking-learning capability is complete,
while reliable ecological performance is still open.
Original Phase 6 sleep/replay remains unimplemented. See
[Waking Learning](https://github.com/smeagol44/vidAI/wiki/Waking-Learning).

## Creatures and sandbox

**Evolvable responses to bites:** Reproduction can now occasionally create a
new, isolated neural microcircuit linking **actual injury** to a random
muscle-control channel. Both the sign and gain are inherited and mutable;
it is not a built-in flee command. In paired short physical trials against
a stationary biting hunter, a sensor-connected Darter increased swimming
stroke amplitude, moved farther away and reduced bite damage (270–330 J
versus 420–450 J in seven bite-contacting setups). Other mutations can
increase damage, so evolution must select useful circuits. Existing
founders are not rewritten and no extra thrust or energy is granted.
These results do not establish escape from pursuing predators or long-term
survival. The current mechanism is documented in the
[GitHub Wiki](https://github.com/smeagol44/vidAI/wiki/Sensory-Behavior).

**Moving-predator results:** Against a self-propelled articulated
omnivore, an inherited injury-to-motor circuit reduced actual bite
damage in **6 of 9 biting scenarios**, tied twice, and increased it
once. Six other starting positions produced no bite and were excluded
from escape claims. When applied to five very different body plans,
the response improved **5 of 15** biting setups, worsened **6**, and
tied **4**. The result is useful as evidence that morphology matters,
not that predators can be reliably escaped. These initial hunters swim using
real joints and water drag but **do not actively home toward prey**.
A later rare inheritable lateral retinal-to-joint circuit can cause
some genuinely late bites on moving prey (4/24 paired trials), but
reliable center-of-mass pursuit was **not** observed.
The selected creature's Brain inspector now displays actual neural
injury signal, queued bitten joules and enabled injury-input wiring.

**Somatic threat sensing:** Creature brains now receive a `body:injury`
input from *real physical bites*, not nearby colors, generic collisions or
predator labels. Energy physically transferred from a victim by a compatible
mouth accumulates as a next-tick sensory signal (60 J fills its 0–1 range).
Existing mouths and conservation accounting remain unchanged. Newly seeded
founders begin with this neuron input disconnected, so their proven visual
weights and swimming behaviors are unaffected; the connection may evolve
in descendants. Existing worlds import into neural brain v7 / save schema
v11 using stable synapse identities, with prior activation/motor state
preserved. This is a prerequisite for evolvable danger responses, **not
a hardcoded escape reflex** or proof of real predator avoidance.


In **balanced founder mode**, the Three-link Darter now has stronger,
ordinary inherited retinal-to-joint neural weights. Against physically
identical retinal-blind and weak-weight comparison genotypes, its new
brain reaches real plant food in seven of eight measured six-second
off-axis target trials (distances 110–190 px). The brain sees only
real attenuated RGB rays and sensory inputs; no target coordinates,
object-type oracle, scripted velocity or energy subsidies are used.
This change affects newly instantiated balanced Darters and their
descendants only. Other founders and previously saved genomes are not
rewritten. Escape from dangerous creatures remains unresolved because
RGB pigments do not reliably encode predator threat.

Current-feature documentation is published to the [VIDA GitHub Wiki](https://github.com/smeagol44/vidAI/wiki), including [Senses and Visually Guided Behavior](https://github.com/smeagol44/vidAI/wiki/Sensory-Behavior)
and [Movement and Motor Control](https://github.com/smeagol44/vidAI/wiki/Motor-Control).
The corresponding Markdown files in `docs/wiki/` are kept in sync by GitHub Actions.


Articulated creatures have torque-driven, drag-based movement. The same
six brain outputs now support both an optional rhythmic oscillator and direct
neural positioning. Descendants can inherit per-joint rhythmic/direct
`oscillatorMix` (0–1) and evolve smooth waveform harmonics (orders 2–5).
Reducing an evolved joint's rhythmic amplitude to zero retains full neural
`Angle` control; oscillation is not required for movement. Each joint can
operate independently, and no force or energy is granted by this controller.
Unchanged founder and imported genomes retain their original exact sine
calculation. Live rhythmic genes are visible in the creature Brain inspector.
Current-feature motor schematics are published in the [Wiki's movement reference](https://github.com/smeagol44/vidAI/wiki/Motor-Control) from the source file `docs/wiki/Motor-Control.md`.


**Phase 5 calibration:** Controlled short experiments revealed that FND-001
(Three-link Darter) originally swam backward with its mouth and eyes pointed
forward. Its newly seeded founder genome now uses a reversed *inherited joint
phase sequence*, not added thrust or scripted target guidance. Under one
repeatable six-second test, the previous gait moved 167 px backward and ate
nothing from a single nutrient directly ahead; the corrected gait moved
249 px forward and consumed 2,520 J from that same nutrient. Blind and
sighted corrected controls both consumed the food, so this demonstrates
physical food access, **not yet intelligent foraging**. Other founders are
unchanged. Existing world snapshots and saved genotypes retain their actual
gait phase values. Paired short vision-on/off tests show weak differences
in steering commands and do not establish obstacle avoidance, learned prey
pursuit or general ecosystem survival.

The existing **Bank** includes 55 built-in founders in eleven body families, with body
previews, family/diet filters and individual spawning. Built-ins do not consume
saved-specimen slots. Standard seeding uses 18 organisms drawn evenly from up to five randomly selected
designs, without replacement at design selection. The same seed reproduces the
same selection; each organism owns an independent genome and brain state. There
is no forced diet quota; some random communities will fare better than others.
The default plant-food target is 400;
**Reset with Catalogue Showcase** starts a new world with up to 55 designs, subject
to the current living-population cap. The old six archetype shortcuts have been removed; use the Bank or Add Life.

Each body face holds either a physical connection (including a part's parent)
or up to three organs **combined**, with stable center/side slots. Eyes and mouths
use exactly those positions for drawing, sight rays and feeding. Eyes and mouths share an extensible surface-organ representation for future organ types. The former global limits of five eyes and three
mouths have been removed; valid face capacity, seven body parts and bounded neural
arrays still constrain anatomy. More eyes cost simulation time and metabolic energy.
Body changes and ordinary mutations need not preserve symmetry.

Twenty-eight existing designs now have more symmetric eye layouts. Five existing
bodies (FND-021/022/024/034/035) have more balanced limbs, while the asymmetric and
irregular families remain distinct. Moonbell Jellyfish (FND-051, **Bell swimmers**)
uses five hinged rectangles—a bell, two rims and two trailing tentacles—with
phased strokes. It is a rigid-part swimmer, not a deformable bell or fluid-jet model.
Four additional jellyfish share that family: Lantern (compact grazer, five parts),
Sailbell (broad grazer, five parts), Ribbon (segmented tentacles, seven parts,
omnivore), and Crown (terminal paddles, seven parts, carnivore). Their bodies,
phases, stroke rates and life histories differ; none use artificial thrust.
Find and spawn them through the Bank's family filter. Its quiet initial neural motor
weights are evolvable; both founder modes still use the same recurrent architecture.
The retinal strip scrolls horizontally for creatures with many eyes.

New saves use schema v11, with identity-stable variable hidden neurons,
inherited memory timescales and explicit disabled neural connections. Founders retain calibrated 24-neuron
brains; offspring can genetically add/remove neurons and mutate connections.
Versions v3–v10 remain importable; lifetime learning is not yet enabled. Imported legacy organ positions and live geometry are
retained; offspring undergoing mutation acquire valid slots. Old fin presets are
repaired for new organisms and mutated descendants, without moving their saved parents.
Zero-mutation legacy clones retain the original anatomy. New imports are checked
before the active world is replaced. Feeding in old saves uses the current rates.

Each hidden neuron now has an inherited activation-memory timescale of 0–4
seconds. A zero value preserves the previous instantaneous recurrent update
exactly; all built-in founders and imported older genomes start at zero.
Descendants may evolve longer memory through rare mutations; stored neuron
activations are still personal, not inherited. Positive timescales blend
previous activation with current sensory/recurrent targets, scaled by real
simulated seconds rather than frame count. Memory costs 0.08 J/s per second
of summed time constants and is charged through the normal conserved energy
ledger. Hover a hidden node to inspect its timescale or inspect the brain
summary for its memory/metabolic breakdown. This is **not** online learning,
synaptic plasticity or sleep/dreaming.

Settings include nutrients (0–800), tank width/height, gravity, population cap
(1–150), viscosity, inflow, seed and founder brain mode. Resizing translates whole
articulated bodies. Lowering the cap does not kill existing creatures. A zero food
target stops automatic and manual nutrient creation. Existing particles are retained.
**Clear Free Nutrients** removes plant food and records its energy in the ledger.
Pink remains are separate animal food: carnivore and omnivore mouths can scavenge
it; herbivore mouths cannot. Uneaten remains become plant nutrients after 60
simulated seconds when a plant-food slot is available, without adding energy. The HUD counts plant food and remains
separately. Transfer rates are now **3,600 J/s per specialist mouth** and **1,800 J/s per
omnivore mouth** (gross, 50% higher than v0.9). A mouth shares its intake limit across all contacted foods and stops
removing food when storage is full. All mouths absorb 80% of removed energy;
20% becomes heat. The existing 85% carrion digestion factor also applies, so
carrion's combined assimilation is 68%. Kin protection defaults on for living
parents/offspring, same-generation siblings and related eggs; unrelated creatures
of the same generation remain edible. Carrion carries no kin protection.

Egg costs now include the full inherited body cost plus
`eggReserveFraction × 10,000 J` in funded hatchling reserve (default 3,500 J).
Parents retain at least 12% of their capacity or 2,000 J, whichever is larger.
A higher egg-reserve gene creates stronger-funded hatchlings at the expense of
later reproduction; no energy is added. Select a white egg in the tank to inspect
its parent, body/reserve funding, incubation progress and actual space, boundary
or population-cap hatching blockers. Current/legacy saves preserve their funded
egg energy; existing eggs are not silently rebalanced.

Diet labels are herbivore, carnivore and omnivore. A creature with different
specialist mouths has an omnivorous overall diet; each mouth retains its own
permissions. Body pigment is inherited independently of diet, including green.
The inherited color-variability trait scales pigment mutation probability; zero
preserves the parent's pigment in its next offspring. Variability itself can
mutate. This is genetic inheritance, not brain-controlled color changing.

Balanced founders have a weak heritable retinal steering prior. Unbiased founders
have random controllers and seeded swimming oscillators. Neither mode is trained,
and neither uses hidden target positions. Both start with 24 recurrent hidden neurons, while the runtime supports 1–96
with an enabled-edge budget of 65,536. Low-probability inherited topology
mutations can add/remove neurons or enable, disable, prune, or reconnect synapses.
New neurons start with only two weak active pathways and no inherited personal
memory; existing neural motor steering remains encoded in mutable weights.
More neurons are not guaranteed to evolve improved foraging or avoidance.
Enabled-edge upkeep is calibrated to preserve the old dense-24 baseline and
rewards lower-cost circuits. Lifetime learning and sleep remain future work.
Every eye supplies five RGB/distance rays; every joint supplies angle and velocity.
Each mouth reports edible contact and normalized absorbed intake from the previous
completed tick. Each joint has six neural outputs: angle, frequency, torque,
stiffness, stroke amplitude and engagement. Commands ramp over 0.12 seconds;
disengaged motors apply zero torque while passive joints and water drag remain.
Neutral new outputs preserve starter gaits; their connections can evolve through
mutation. These controls do not train founders or guarantee successful foraging.
Nonzero longitudinal water resistance slows passive coasting. The inspector shows
per-joint stroke amplitude and engagement alongside the live brain graph.

Only physical creatures, food particles (including pink remains) and white eggs
produce retinal colors. Walls, water, grid and display effects return black.
Distance attenuates surface RGB toward black; the distance channel remains.
Nutrient cores stay fixed while only their display glow pulses. Mouth openings
animate during actual feeding. Display water and boundaries remain visible to
the player.

Solid rotated body rectangles collide with other creatures and their own
nonadjacent parts. Directly hinged neighbors are exempt to allow bending. All
bodies advance on one substep clock, with inelastic contact impulses and positional
hinge repair before feeding. A spatial broad phase limits collision candidates.
This is a discrete frictionless solver, not continuous collision detection.

The canvas fills the area between the toolbars using equal X/Y world scale;
changing screen shape changes the visible area rather than stretching bodies.
Floating windows scroll, resize from their lower corner, and stay inside that
area after dragging or viewport changes. The current build appears at bottom right.

**Copy Diagnostic Report** provides settings, seed/PRNG, population, death history,
energy balance and selected-creature telemetry. Current v6 snapshots preserve
motor ramps, oral feedback, pigment variability, decomposition timers and complete
simulation state/settings for exact continuation in this build. Older v3/v4/v5
JSON worlds import under the updated rules; existing neural commands and memory
migrate by eye/part/mouth channel IDs and omitted environment settings use defaults. Imported worlds preserve their exact saved time while pausing for inspection;
callbacks holding the previous settings cannot advance replacement state.

## GitHub Pages

The repository's Pages source should be **GitHub Actions**. Every push to `main`
runs simulation tests, type checks, a production build and a Chromium smoke test,
then deploys `dist` to Pages. Pull requests run the checks without deployment.
The workflow can also be started manually from the Actions tab.

Vite's base URL is `/vidAI/`; update `vite.config.ts` if renaming the repository
or moving to a custom domain. Images and music use imported asset URLs, so they
resolve correctly below the repository subpath.

## Controls

Choose **Seed Simulation** to start. Drag the tank to pan and scroll to zoom.
Click a creature to inspect it. Space pauses/resumes; the on-screen buttons
provide settings, simulation speed, specimen tools, ecosystem export/import,
and diagnostics. The help panel lists the other shortcuts.

Simulation energy and time use the game's existing calibrated units. Finite
lifespans and natural extinction remain enabled. See [project status](docs/PROJECT_STATUS.md)
for verified repairs and remaining limitations. Original asset provenance is
retained in `design/asset_manifest.json` and `THIRD_PARTY_NOTICES.md`.

Version 0.6.0 adds a whole-body feeding flag (actual intake during the previous
completed tick) and normalized center-of-mass depth (surface 0, floor 1). Current
usable energy already has a normalized reserve/capacity input. Per-mouth contact
and intake inputs remain. Brain v4/schema v8 migrate old channels by stable IDs,
preserving their weights, recurrent memory, outputs and PRNG; new old-save
pathways start neutral. New founders can evolve/use the added senses.

Mature eggs now wait until the newborn's full initial bounding envelope is clear
of living bodies and inside the tank. Eight deterministic orientations are tried
at the egg's position; eggs are never teleported. Waiting retains the funded
reserve, stored heading, predation exposure and population-cap rules. This prevents
newborn limbs from appearing around a passerby as well as direct overlap. It is
conservative and can delay hatching near densely packed bodies.

Routine GitHub validation runs fast automated tests and the production build.
Full simulations and browser checks remain available through a manual workflow
run with **extended_validation** enabled; they no longer run on every release.

## Performance architecture

The v0.31 performance branch moves authoritative fixed-step simulation into a
Web Worker, with bounded render frames on the UI thread. Neural connection masks
and plastic indices are cached, acquired synapse records are reused, and food
and carrion glow sprites are cached. Each new corpse produces one larger edible
circle containing all its remaining energy. Existing saved fragments still load.

Run `npm run build && npm run test:worker` for the production Worker transport
check. `npm run benchmark:performance` measures the 15-creature / 78-food /
221-remains masked-brain workload. Add `-- --baseline /path/to/checkout` for
an identical-state comparison against a previous local checkout with dependencies.
Browser FPS remains hardware dependent. `?mainthread` selects the diagnostic
fallback; every organism is still simulated off-camera in either mode.
