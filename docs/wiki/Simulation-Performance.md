# Simulation Performance

VIDA 2D is a native-physics, browser-rendered artificial-life simulator.
Every organism is simulated, even when off-camera. Physics, neural
evaluation, vision, metabolism and mouth contact run each simulation tick;
Canvas rendering is a separate presentation step.

## Current optimizations

- **Food vision:** Retinal rays use a transient 128px spatial grid of
  all nutrients, including carrion. The ray's bounding rectangle is
  enlarged by the largest actual nutrient radius before selecting
  candidates. Those candidates are visited in the exact previous
  food-array order, preserving strict nearest-hit ties. Physical
  RGB, occlusion and distance calculations are unchanged.
- **Dissolution:** A dissolving creature can append carrion during
  the current organism pass. The grid rebuilds when the array's
  length changes, so later eyes do not miss newly formed remains.
- **Off-screen rendering:** Camera bounds exclude nutrients, eggs
  and caustic glows that do not overlap the visible world-space
  viewport. This only skips paint calls, not simulation.
- **Body contacts:** Already use a spatial broadphase. Brain
  structure, physical joint constraints, water drag, conserved
  energy, saved worlds and gene mutations are unchanged.

Spatial acceleration is per-step scratch state; it is never added
to the saved snapshot or used as a new neural input.

## What remains expensive

- Joint solving integrates **four physical substeps per 1/60s tick**,
  including multiple constraint iterations.
- Creature and egg vision still perform direct geometry scans.
- Each *visible* nutrient still draws gradient/glow effects.
- Rendering and the physics kernel run on the same browser
  main thread, so heavy simulations can lower both FPS and
  actual physics steps per second.

The HUD shows **FPS** and **Steps/s**. At 1x target speed, 60
physics steps/s corresponds to real-time 60Hz simulation.
An elevated render FPS cannot compensate for physics
falling below 60 steps/s; and low FPS with normal steps/s
usually means paint or main-thread scheduling is expensive.

## Representative load and validation

The regression suite includes **20 articulated organisms,
200 plant nutrients and 180 carrion objects**, with physical
neural updates, exact snapshot continuation and energy
conservation. Separately, seeded ray fixtures prove the index
does not skip a valid intersecting nutrient or rearrange
nearest-hit tie order. These validate function, **not a
specific speedup on your GPU/CPU or browser**.

The separate physics/render thread is a **deferred milestone P**
to begin after the present ecological acquisition and natural
reproduction work. At that stage, use FPS, Steps/s and the real
20-creature/380-food workload to profile main-thread CPU load,
then move the authoritative physics into a Web Worker without
changing ecological behavior, saves or energy conservation.
Do not silently stop off-camera life or reduce neural fidelity.

## Would native desktop help?

**Electron** packages Chromium, and **Tauri** embeds an OS web view.
Both can distribute a desktop application, but running the
same TypeScript kernel and Canvas rendering is unlikely to
dramatically increase raw simulation speed. A future
**Web Worker** can separate physics from painting in the web
version; a separately optimized **WebAssembly or compiled
native** simulation kernel can offer additional options,
but requires a carefully validated port of physics, neural
state, determinism and energy bookkeeping. Native packaging
alone is not an optimization.

This page describes current performance architecture,
rather than tracking historical benchmark results.
