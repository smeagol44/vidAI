# Initial environmental scenarios

Implements the Default/Harsh World start selector tracked in #119.

The start menu has an **Environment** dropdown with **Default** preselected
and **Harsh World**. Native world/mountain glyphs keep icons inside both native
options without dependencies or a replacement keyboard/touch selection widget.
Choose the environment, then use the existing Seed Simulation, Predator Cove
or Megafauna founder-population button. Founder brain mode remains independent.

| Setting | Default | Harsh World |
| --- | --- | --- |
| Recycling rate | Configured default (15/s) | 1/s |
| Nutrient count cap | Unlimited | 200 |
| Initial free nutrients | Configured grant (275) | 0 |
| World energy budget | Existing founder + nutrient grant | Same grant for the same seed/population |
| Tank | Configured default (2400 × 1500 px) | 4800 × 3000 px |
| Vertical gravity | 0 px/s² | 20 px/s² |
| Maximum creatures + eggs | 30 | 50 |
| Viscosity | Resolved configured default (currently 0.18) | 0.40 |
| Initial population | Existing founder preset | Same preset; normally 18, not 50 |
| Other settings | Existing defaults | Existing defaults |

`constants.ts` loads `playground_config.json` and any existing Playground
overrides. Its viscosity fallback is 0.22, but the committed configuration
currently resolves to 0.18. Neither these values nor historical kernel defaults
in `persistence.ts:DEFAULT_SETTINGS` change with scenarios.

## Initialization and energy

`environmentScenarios.ts` wraps the unchanged `createInitialWorld`. Default
passes settings through without additional simulation operations or random
draws. Harsh overrides only the listed settings, creates the usual funded
world, then calls existing `clearFreeNutrients` synchronously before
`replaceWorld`, Worker reset or any simulation tick. The temporary food
particles are never published.

The existing initializer grants the full nutrient allocation before banking
food above the count cap. Clearing remaining free food banks its energy too.
With the current 275 × 3000 J grant, Harsh starts with 825,000 J in the world
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
Switching Harsh back to Default therefore carries over no Harsh overrides.
Existing in-world reseed/showcase controls retain their previous current-settings
initialization semantics, including resetting the nutrient cap to Unlimited.
They do not lock or continually reapply the start-menu selection.

Imports, exact exports and ecosystem branching never call the scenario factory.
They preserve saved settings, energy stocks, PRNG and continuation. No scenario
ID or schema field is persisted; selected Harsh does not reinterpret an old save.

## Verification

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

Fractional recycling and named custom profiles remain deferred in #119 and the
contributor-only journal (excluded from this submission); neither is implemented here.
