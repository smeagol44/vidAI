# Initial environmental scenarios

This document covers the implemented **Default / Harsh World** starting
selector ([#119](https://github.com/smeagol44/vidAI/issues/119)) and the
**Pipe World** preset
([#135](https://github.com/smeagol44/vidAI/issues/135),
[fork PR #53](https://github.com/hernansgarro/vidAI/pull/53)).
The three presets are integrated in production v0.40.0 through #134.

The start menu's **Environment** dropdown offers Default, Harsh World, and
Pipe World. Default/Harsh use the established native glyphs; Pipe uses an
original retro green pipe icon. Choosing a scenario never selects the founder
organism family or brain mode: the existing Seed Simulation / Predator Cove /
Megafauna choices remain independent.

| Setting | Default | Harsh World | Pipe World |
| --- | --- | --- | --- |
| Recycling rate | Configured default (15/s) | 1/s | 1/s |
| Nutrient count cap | Unlimited | 200 | 200 |
| Initial free nutrients | Configured grant (275) | 0 | 0 |
| World energy budget | Existing founder + nutrient grant | Same grant for the same seed/population | Same grant for the same seed/population |
| Tank | Configured default (2400 × 1500 world units) | 4800 × 3000 | **4600 × 2100** |
| Vertical gravity | 0 | 20 | 20 |
| Maximum creatures + eggs | 30 | 50 | 50 |
| Viscosity | Resolved configured default (currently 0.18) | 0.40 | 0.40 |
| Initial population | Existing founder preset | Same preset; normally 18, not 50 | Same preset; normally 18, not 50 |
| Starting tube connections | None | None | **None** |
| Observer auto-selection / auto-tracking | On / On | Off / Off | Off / Off |
| Water caustics display | On | Off | Off |
| Other settings | Existing defaults | Explicit Harsh preset values | **Independent explicit copy of the initial Harsh values**, except for tank size |

`constants.ts` loads `playground_config.json` and any existing Playground
overrides. Its viscosity fallback is 0.22, but committed configuration
currently resolves to 0.18. Neither these values nor historical kernel
defaults in `persistence.ts:DEFAULT_SETTINGS` change with scenario selection.
Pipe World does not use `Harsh World` as an alias, dynamic spread or runtime
source; its recipe is an independent constant so future edits do not leak
between scenarios.

## Initialization and energy

`environmentScenarios.ts` wraps the unchanged `createInitialWorld`. Default
passes settings through without additional simulation operations or random
draws. Harsh and Pipe apply their independent, explicit scenario
settings, create the usual funded world, then call existing
`clearFreeNutrients` synchronously before `replaceWorld`, Worker reset or
any simulation tick. The temporary food
particles are never published.

The existing initializer grants the full nutrient allocation before banking
food above the count cap. Clearing remaining free food banks its energy too.
With the current 275 × 3000 J grant, Harsh and Pipe start with 825,000 J in the world
reserve, in addition to the same founder funding as Default. No budget edit,
external source or simulation-law change is added. The existing clear operation
also records its cumulative loss diagnostic and resets the nutrient accumulator;
closed-world stock conservation uses embodied energy plus signed reserve,
not cumulative diagnostic counters.

Recycling remains the existing funded 1/s accumulator and stops at 200 free
nutrients or unavailable reserve. No survival guarantee, founder tuning, food
placement assistance or revised egg uptake/expiry rule accompanies the setting.

## Controls, resets and snapshots

Settings and camera center are installed with the new world; normal controls
show those actual values and remain editable. Selecting an option alone never
changes the active world.

Returning to the start menu and launching an explicit scenario uses the original
configured application defaults, independent of previous slider edits/imports.
Switching Harsh or Pipe back to Default therefore carries over no previous scenario overrides.
Existing in-world reseed/showcase controls retain their previous current-settings
initialization semantics, including resetting the nutrient cap to Unlimited.
They do not lock or continually reapply the start-menu selection. Advanced
Settings exposes a manual **Show water caustics** checkbox. Its initial value
is scenario-specific (Default on, Harsh/Pipe off), and an in-world reseed
preserves the current observer override. Hiding caustics skips only their
decorative canvas paint/blur pass; it never removes objects from world state,
changes Worker settings or alters the random stream. The checkbox round-trips
through observer snapshot metadata. Old snapshots without it still show caustics.

Imports, exact exports and ecosystem branching never call the scenario factory.
They preserve saved settings, energy stocks, PRNG and continuation. No scenario
ID or schema field is persisted; selected Harsh/Pipe does not reinterpret an old save.

## Verification

Fork Pipe-specific validation: [PR #53](https://github.com/hernansgarro/vidAI/pull/53)
passed npm ci, 385/385 fast tests, build, actual Worker checks,
and remote Chromium/Firefox scenario/toolbar/side-window gates. It verifies
the frozen preset, 4600 × 2100 dimensions, zero initial topology,
funded initialization, independence, and exact schema19 reload/continuation.
See [#135](https://github.com/smeagol44/vidAI/issues/135) for the original delivery and acceptance record.


- `tests/environment-scenarios.test.ts`: full Default equivalence, requested
  settings, manual-clear equivalence, budgets, both brain modes/four founder
  populations, funded 1/s conversion/200 cap and edited continuation.
- `scripts/check-environment-scenarios-baseline.ts BASE_CHECKOUT`: initialization
  plus 30 exact ticks for 16 seed/mode/population combinations, for both worlds
  versus pre-change manual configuration. No fields excluded or golden refresh.
- `scripts/check-worker.mjs`: actual production Worker time-zero state, full
  grant, edited control packets, exact direct stepping and snapshot reset.
- `e2e/environment-scenarios.spec.ts`: native options/icons, desktop/phone bounds,
  actual initial/reset packets, controls, founder buttons and exact imported
  state in Worker and fallback; existing Chromium/Firefox smoke CI.

Fractional recycling controls and named custom environment profiles remain
unimplemented; they are independent of the current presets and per-particle decay.
