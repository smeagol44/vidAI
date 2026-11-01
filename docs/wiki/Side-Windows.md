# Self-Linked Windows and Physical Tubes

VIDA 2D provides window geometry, local names and explicit call/window consent.
Accepted self-linked channels transfer complete living organisms between their
opposite ends locally, without a server. The controls coexist with forward mouths,
x0 pause/MAX, measured throughput, feeding halos and egg reserve display.
Camera gestures remain available while stopped without advancing simulation time.
Remote discovery and transport (stage4) remain deferred.

## Window geometry

The independent `MIN_WINDOW_HEIGHT = 300` is in world units, never screen pixels
or a fraction of a configured default. For positive actual tank height `H`:

```text
N = max(1, floor(H / 300))
sectionHeight = H / N
```

Each side has `N` uniformly sized sections, numbered upward from the floor:
`L0`, `L1`, … and `R0`, `R1`, … internally. Visible section-name labels and
yellow boundary dots are absent; accessible control names retain logical indices. Growing or shrinking redistributes sections
by the same formula. Camera/browser changes affect only their screen positions.

| Actual height | Sections per side | Section height |
| --- | ---: | ---: |
| 100 | 1 | 100 |
| 299 | 1 | 299 |
| 300 | 1 | 300 |
| 599 | 1 | 599 |
| 600 | 2 | 300 |
| 800 | 2 | 400 |
| 1500 | 5 | 300 |
| 1600 | 5 | 320 |
| 1799 | 5 | 359.8 |
| 1800 | 6 | 300 |
| 3000 | 10 | 300 |

Below 300 units, the one full-height section is the sole minimum-height exception.
Existing resize controls remain 600–3000 units high; the geometry also handles
smaller positive heights without changing these controls or imposing a count cap.

## Phone, local name and self-selection

1. Press either side's phone. Enter a display name and press **Save**. The name
   stays in this page session only: it is not an account, verified unique identity,
   browser-stored profile or simulation-save field. Names are limited to 32
   characters; edits update the same local identity without clearing agreements.
2. Saving the first name makes both local phone endpoints available for this
   tank's self-call. Either side's **Turn availability off** hides that endpoint
   from new local calls; **Make phone available** restores it. Both must be
   available to start a self-call. Turning availability off during an existing
   connection does not disconnect it or cancel window agreements. Turning it
   off during a pending call explicitly cancels that invitation.
3. The **Available people · local** menu contains your own name, marked **You**,
   when both endpoints are available. Select it to call the opposite phone.
   The list contains no fabricated remote people and is not an online directory.
4. The receiving phone rings and automatically shows a compact bubble with your
   name and **Accept / Decline**. It does not steal focus, dim the page, pause the
   simulation, block other controls or require an answer. There is no response
   deadline. Ring motion respects reduced-motion settings. The caller can
   **Cancel call**, which clears the receiving bubble, then choose again.
5. Only the receiver's explicit **Accept** connects the sides. Answering a call
   opens no numbered windows. One local side-link exists at a time; concurrent
   calls are unavailable while it is pending or connected.

This replaces the former Pair L ↔ R simulation button. The menu can edit the
name, change availability, or **Disconnect · retain agreements**. Disconnection
suspends accepted windows and hides their tubes; reconnecting to the same local
self restores them. There is no floating call-reset control. Display names and
pending calls remain session-only; physical topology is saved with the world.
Reload starts the ordinary new world; importing a topology snapshot restores its
connection and agreements without inventing a saved name.
Menus follow their phones and may leave the visible viewport; pan the tank to
bring them back into view. They close with their close button or Escape. All name/menu typing is isolated from simulation shortcuts.

## Separate window consent and physical tubes

Window controls are unavailable until the local phone call is accepted. Press
any closed/rejected section to offer it: the sender shows an outgoing hand and
its counterpart shows an incoming hand. The receiver can press its incoming
hand to accept, or the small **×** to decline. Pressing the sender's outgoing
hand cancels the offer; it cannot accept its own offer. The directional SVGs
preserve the meanings of 🫱/🫲/🫸/🫷 without relying on installed emoji fonts.

After acceptance both ends show a handshake. Each accepted section displays a
**300-world-unit** outward glass/water extension on each side. Consecutive
accepted sections merge into a continuous corridor: only the bottom and top of
that group have horizontal glass edges. There are no internal crossbars between
adjacent accepted windows. Isolated and nonconsecutive groups work independently.
Opening every window extends only the tank floor and upper boundary.

Tube water uses the same continuous aquarium background, without a separate
cyan tint or overlay. The horizontal glass edges diffuse outward over the same
300 units, including the outer 100 units used for transport rearm. The distal end is
visually uncapped: no perpendicular end wall, membrane or plug. The original
lateral wall opens only at accepted windows. Closed sections remain solid.
Organisms, food and eggs occupy the channel water and obey the same local
physics, feeding and ecological rules as the tank. Ordinary nutrient generation
samples this additional area without increasing its rate or creating energy.
Closed-world generation spends the same available reserve.

Press either handshake to close that tube and cancel its agreement.
Window controls remain beyond the 300-unit tip with 12 CSS pixels of clearance
and constant 30-pixel hit targets. Phone indicators remain separate below the floor.
Painting and camera positioning reuse the existing draw pass; there is no extra
animation loop or per-frame React update.

## Suspension, closing and world state

Disconnection replaces the handshake **in the same section button** with the
lost-signal icon and removes its tube. Click that icon to cancel the retained
agreement. Hidden accepted indices, removed by a height reduction, instead have
lost-signal chips beside the phone. Regrowth or reconnection restores retained
agreements; availability alone does not cancel them.

Closing/disconnecting an occupied channel returns outside organisms intact into
the main tank by horizontal whole-body translation. Food and eggs return without
losing their energy. This is an explicit geometry edit, not ordinary locomotion.
Resizing retains the existing whole-body placement rules and hidden agreements.
Commands run in the authoritative Worker (or existing fallback) even while paused;
old-world commands cannot change a newly imported/reset world.

## Local full-state handoff

A living organism transfers when its root-segment center moves outward across
300 units beyond an accepted side. One complete live record replaces that same
array entry at the end of the normal tick. Every segment, trace and ray-debug
point receives the same translation; articulated shape, velocities, joints,
genome, neural memory/learning, age, reserves and lineage remain intact. No spawn
routine, new ID, PRNG draw, duplicate organism or birth event is involved.

Left exit arrives 200 units beyond the right wall; right exit arrives 200 units
beyond the left wall. Velocity is unchanged, so outward source motion becomes
inward destination motion. The organism must travel another 100 units outward
before it could return. Matching self-sections have equal heights, so signed
proportional vertical mapping preserves the same world y coordinate without
scaling the body. Food and eggs crossing an open end continue locally as well.
Destination contacts are resolved normally on subsequent ticks.

The observer scene is painted back to front: background water/grid/caustics,
existing food/egg glows, entities, and human annotations (incubation
indicators, selection, traces and aperture/ray diagnostics). One reusable canvas
composites these passes; it does not create extra animation loops. A universal
mask then darkens everything above and below the tank and fades both sides
along the **entire tank height**, regardless of open windows or topology.
Opacity decreases cubically with outward distance: about 3.7% at 200 units and
zero at 300. Each fragment, including protruding mouths, trails and glow, is
masked by its actual screen/world position. There is no root-based or
whole-organism opacity multiplier. The same aquarium water continues into the
sides with no added tube tint. Glass tank/tube edges paint above the mask;
connection controls and existing application windows remain above the glass.
Drawing writes no opacity to world records and changes no sensors or physics.

The existing canvas selection remains unchanged: creatures and eggs can still
be selected inside tubes. The painted mask has no DOM hit surface and consumes
no pointer events. Only actual buttons, dialogs and application windows consume
their own input.

An eye control sits at phone height, centered below the tank. Open shows call,
name and window controls; closed hides them, while accepted physical tubes and
the running world remain intact. The closed eye is faint until hovered/focused.
This is session-only observer state, not a world command or saved setting.
Phone menus and incoming-call dialogs open 12 screen pixels **below** their
phone button and follow its world/camera anchor. They do not clamp to the
viewport: pan the tank to bring an off-screen phone or menu into view. Existing
application windows retain their normal positioning.

Vision uses the actual local scene; there are no wrapped rays, remote views or
destination copies before handoff. Consecutive windows share glass geometry,
while the crossed section still determines its matching opposite section.

Snapshots carrying physical topology use schema17; worlds without topology use
forward-mouth schema16. Historical schema12–15 files still load through the
owner-accepted automatic mouth conversion. Old schemas reject embedded topology.
Living, egg and lineage genomes retain their forward reach and fixed diet width;
malformed mouth parameters are rejected before replacing the world. Both current
formats preserve exact continuation after the accepted migration.
Display names, availability and pending invitations are not save
fields. Full-state single-creature file exchange, remote users, accounts,
network discovery and cross-world identity/statistics remain outside this stage.
