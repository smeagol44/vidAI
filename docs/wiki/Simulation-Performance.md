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
  and one-circle corpse conservation.
- `npm run build` then `npm run test:worker` execute the actual production
  Worker bundle on a separate thread, checking independent progress,
  paused exact exports, commands and stale-world rejection.
- A dedicated browser smoke checks the UI's real Worker, import/export,
  pause, Feed and Add Life in GitHub Actions.
- `npm run benchmark:performance` measures 15 creatures, 78 nutrients
  and 221 remains with evolved connection masks. An optional local
  `--baseline` checkout compares timings and requires identical final
  states. This is a kernel benchmark, not a browser FPS promise.

Joint constraints, body/egg vision scans and large evolved neural layouts
can still dominate CPU time. Profile actual evolved worlds before the
next optimization. Native desktop packaging alone does not remove those
costs; compiled/WASM kernels remain a separate future option.
