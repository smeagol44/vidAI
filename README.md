# VIDA / vidAI

A 2D aquatic artificial-life simulator with articulated bodies, torque-driven
swimming, recurrent neural controllers, individual learning, physical feeding,
funded eggs and inherited body/brain mutations.

By Hernán Garro & Federico Regueira.

**[Play VIDA](https://smeagol44.github.io/vidAI/)** ·
**[Current Wiki](https://github.com/smeagol44/vidAI/wiki)** ·
[Development priorities](docs/FEATURE_ROADMAP.md) · [Experiment history](docs/PROJECT_STATUS.md)

## Current scope

- Nine featured starters from nine source families; all 55 legacy designs remain in the Bank. New worlds start with 18 creatures from at most five featured designs, a living cap of 30 and plant-food target of 275.
- Variable inherited brain structure, recurrent activation memory and bounded waking sensory/motor learning are implemented. Personal learned weights are separate from inherited genes.
- Physical feeding, paid eggs, hatching, death and chemical accounting exist. Reliable foraging, pursuit and self-sustaining ecosystems remain unproven.
- Worker/render separation is deployed. Optional sleep/replay, physical growth, tissue repair and gradual senescence are not implemented.

The Wiki describes current features and limitations. Original Phases 1–4 have
their core implementation; Phase 5's bounded waking-learning feature set is
implemented; Phase 6 remains optional future work. B-A–B-D is a separate,
completed prototype behavior/measurement workstream.

## Run locally

Use Node.js 24 (minimum 22.12). No API keys, backend or Playground SDK are required.

```sh
npm ci
npm run dev
```

Open the printed URL ending in `/vidAI/`. Images, styles and audio are bundled.

## Validate and inspect

```sh
npm run test:fast
npm run build
npm run test:worker
npm run preview
```

The Worker check needs the production build first. Optional tools:

| Command | Purpose |
| --- | --- |
| `npm test` | Full simulation test suite |
| `npm run test:e2e` | Browser suite; install the corresponding Playwright browsers first |
| `npm run benchmark:ecology` | Bounded read-only ecological reports |
| `npm run audit:foraging` | Twin Oar physical food approach and scattered-food comparisons |
| `npm run audit:locomotion` | Passive drag/spin and muscle-scaling checks |
| `npm run search:locomotion -- --check` | Reproduce the bounded starter calibration |
| `npm run benchmark:performance -- --baseline /path/to/checkout` | Identical-state kernel comparison |

Routine CI validates fast tests and the build. Focused Worker/browser and
locomotion checks run when their workflow paths match; broader validation can
be requested through the manual workflow. Main-branch Pages publishing follows
successful validation. `docs/wiki/` automatically publishes to the actual Wiki.

## Controls and saves

Choose **Seed Simulation** to start. Drag to pan, scroll to zoom and press Space
to pause/resume. Toolbars provide settings, speed, feeding, spawning, specimen
Bank, export/import and diagnostics. Click a creature for general status;
**Inspect** opens diagnostics with display pruning reset to 0.5.

The initial UI seed is random and editable; reset reuses the displayed seed.
Current saves use schema v12 and brain v7, including a validated physics regime.
Older v3–v11 snapshots continue with exact legacy physics/energy rules; new
worlds use coherent surface drag and prepaid muscle work. PRNG, personal memory
and stored genes remain intact. Reset starts a new world with current physics. Imports pause for inspection;
starter calibration never rewrites stored genomes.

Vite's Pages base is `/vidAI/`; update `vite.config.ts` if moving the project.
Rendering FPS and simulation Steps/s are separate measurements. See the
[performance reference](https://github.com/smeagol44/vidAI/wiki/Simulation-Performance)
for ownership, pacing and scaling limits.

Original asset provenance remains in `design/asset_manifest.json` and
`THIRD_PARTY_NOTICES.md`. The separate `smeagol44/vidAI3D` project is independent.
