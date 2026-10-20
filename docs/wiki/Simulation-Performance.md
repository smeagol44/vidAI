# Simulation Performance

VIDA 2D runs the authoritative 1/60-second simulation in a Web Worker.
Canvas painting, camera controls and the interface remain on the main
thread. All creatures continue sensing, moving, eating and evolving
off-camera; rendering never decides which organisms are simulated.

## Neural and learning execution

Neural topology is compiled into transient numeric masks and plastic-edge
indices. The inner neural loops read actual genome weights in their
original order, without serializing a JSON edge identifier for each
synapse on every tick. Topology changes invalidate the cache; changing
weights never leaves cached weight values behind.

Individual acquired synapse records and temporary numeric buffers are
reused. Genetic and somatic memory remain separate, energy-paid and
bounded. Saved edge identities, PRNG, learning arithmetic and existing
brain structure are preserved. Caches are never saved.

## Kernel geometry and hatching

Ready eggs still try the same eight orientations every simulated tick.
Their clearance checks share the living-body bounds for that tick's egg
pass. Each successful hatch immediately adds the newborn's bounds, so
later eggs cannot hatch through it. The index is rebuilt on the next tick;
blocked eggs retain all funding and their stored heading.

The velocity constraint solver computes anchors, effective masses,
position bias and angle-limit error once per substep. These values remain
constant through its ten velocity iterations; all ten impulses and all
four physical substeps are retained. Body-contact wrappers are reused,
but moving bounds are recomputed on every contact pass in original order.

Vision reuses exact rectangle corners during the pre-movement sensing
pass. Surface pigment still reads the current reserves at each hit.
Food and contact grids use numeric cell coordinates; candidate ordering,
occlusion, neural sums, learning and randomness retain their prior math.

## Rendering and remains

- Three reusable glow images cover ordinary nutrients, larger nutrients
  and carrion. Each visible particle scales the appropriate image rather
  than constructing its own radial gradient every frame.
- Food, eggs and caustics outside the viewport skip paint calls.
- Every newly dissolved organism leaves **one larger edible carrion
  circle** holding its remaining reserve plus tissue energy. Its radius
  follows the existing energy-to-radius rule and shrinks during feeding.
  This replaces the former collection of 3000-J fragments. Full-buffer
  losses remain recorded in the energy ledger.
- Old saved fragments remain intact when imported. The new corpse layout
  intentionally changes future food geometry and random draws at death;
  importing a save never deletes or silently merges its existing remains.

## Worker state and controls

The Worker is the sole owner of living state and randomness. Feed, Feed All,
spawn, clear-food and resize requests execute between complete ticks.
Exports, forks and diagnostic reports request exact authoritative state,
including PRNG and all acquired memories; render frames are never used
as saves.

Render updates are bounded to 30 per second, with **one frame in flight**.
Genomes transfer once, lineage sends changed records, and heavy neural
inspector state is sent only for the selected animal. Paused worlds do
not stream unchanged frames. World epochs discard stale messages after
reset/import. Worker errors pause the simulation visibly.

Worker batches yield after about 8 ms. When ticks are overdue, the next
batch queues through a MessageChannel rather than adding a nested-timer
wait. Light worlds still sleep until another tick is due, and paused
worlds use an idle timer. Time spent computing counts toward pacing.
This does not make an expensive tick cheaper or parallelize the kernel.

Unsupported Workers retain the main-thread execution path. The diagnostic
URL option `?mainthread` explicitly selects it. A CPU-bound Worker can
still fall short of the requested simulation speed; separation protects
UI responsiveness without inventing extra simulated time.

## Measurements and checks

The HUD distinguishes **FPS** from **Steps/s**. At 1x, 60 physical ticks
per real second is real-time simulation; at 5x the target is 300.
Render FPS alone does not measure simulation throughput.

- `npm run test:fast` includes complete-state hashes captured before the
  neural optimization, cold-cache saves, Worker-host command accounting
  one-circle corpse conservation and Worker pacing boundaries.
- `npm run build` then `npm run test:worker` execute the actual production
  Worker bundle on a separate thread, checking independent progress,
  paused exact exports, commands and stale-world rejection.
- Dedicated Chromium and Firefox smoke checks cover the UI's real Worker,
  import/export, pause, Feed and Add Life in GitHub Actions.
- `npm run benchmark:performance` measures 15 creatures, 78 nutrients
  and 221 remains with evolved connection masks. An optional local
  `--baseline` checkout compares timings and requires identical final
  states. This is a kernel benchmark, not a browser FPS promise.

- `node --import tsx scripts/profile-performance.mjs [checkout]` samples
  three bounded kernels: 15 founders, 30 second-generation animals, and
  the same 30 with 75 blocked eggs (each has 200 nutrients/180 remains).
  Fixed complete-state hashes require exact v0.31 continuation.
  The throughput diagnosis workflow is opt-in outside its development branch.

Joint constraints, body/egg vision scans and large evolved neural layouts
can still dominate CPU time. Profile actual evolved worlds before the
next optimization. Native desktop packaging alone does not remove those
costs; compiled/WASM kernels remain a separate future option.
