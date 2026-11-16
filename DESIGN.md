---
name: Paladin
description: A restrained Formula 1 timing wall for auditable prediction and decision intelligence.
colors:
  carbon-page: "#0a0b0e"
  carbon-tower: "#06070a"
  carbon-panel: "#101318"
  carbon-panel-raised: "#161a21"
  timing-white: "#f4f4f2"
  record-steel: "#c5cad1"
  muted-steel: "#98a0ab"
  signal-red: "#e10600"
  signal-red-text: "#ff5a4d"
  hairline: "#262b33"
  hairline-strong: "#39414c"
  assumption-amber: "#ffb020"
  verified-green: "#3ddc84"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.025em"
rounded:
  square: "0"
  status-dot: "999px"
  pill: "999px"
spacing:
  control-x: "1.15rem"
  control-y: "0.55rem"
  panel-sm: "1rem"
  panel-md: "1.5rem"
  panel-lg: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.signal-red}"
    textColor: "#ffffff"
    typography: "{typography.display}"
    rounded: "{rounded.square}"
    padding: "0.55rem 1.15rem 0.5rem 1.3rem"
    height: "2.75rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.timing-white}"
    typography: "{typography.display}"
    rounded: "{rounded.square}"
    padding: "0.55rem 1.1rem"
    height: "2.75rem"
---

# Design System: Paladin

## Overview

**Creative North Star: "The Matte Timing Wall"**

Paladin is an operating surface for evidence, not a racing spectacle. Its world combines a restrained Formula 1 timing wall with an engineering incident review: dense but scannable, materially matte, and explicit about what was known, predicted, recorded, derived, or simulated.

The system supports two complementary modes without changing identity. Historical and model routes are read in a deliberate evidence sequence; Decision Replay and Race Lab become compact command surfaces where circuit, timing, strategy, and race-control state are functional. Expression comes from condensed type, exact alignment, hairline structure, and rare signal colour rather than decorative telemetry.

**Key Characteristics:**

- Carbon-black surfaces separated by hairlines and tonal steps.
- Condensed, tabular decision type paired with plain explanatory copy.
- Provenance stated in text and reinforced by a small semantic colour vocabulary.
- Square geometry with a single chamfered primary-action signature.
- Responsive structures that reflow without concealing evidence.

## Colors

The palette is a low-reflectance carbon field with white and steel records, one red model signal, amber assumptions, and green verified agreement.

### Primary

- **Signal Red:** Marks model activity, the lights-out boundary, selected high-priority state, and primary action. It is a signal, not a wash.

### Secondary

- **Assumption Amber:** Identifies illustrative, derived, or simulated assumptions and warning notes.
- **Verified Green:** Appears only for verified agreement, a correct hit, or checked positive state.

### Neutral

- **Carbon Page / Tower / Panel / Raised Panel:** Establish page depth through tonal layering rather than floating cards.
- **Timing White:** Carries primary decisions, values, and active controls.
- **Record Steel / Muted Steel:** Carry historical context, labels, and secondary explanation.
- **Hairline / Strong Hairline:** Divide working regions and express control boundaries.

### Named Rules

**The One Signal Rule.** Red remains rare enough that it always communicates model activity or immediate action.

**The Provenance Rule.** Colour may reinforce evidence class, but a visible text label must name that class.

**The Timing Colour Rule.** Purple is the best of what is being compared, as on a timing screen: the highest score of the three models on a metric, the best value in a row of two drivers' season figures, the quickest lap of the seasons listed, the fastest lap in the timing tower. It is only ever drawn where there is something to compare it with (one season has no quickest, and equal values have no best), a legend or a word beside it says what it means (colour never says it alone, and a screen reader hears "Highest" or "Best"), and it claims no more than the numbers do: the model table says in the same breath that its gaps are within noise. Red is for the model and for action, never for "best".

**The Team Colour Rule.** Constructor colours identify competitors only; they never become page accents or evidence colours.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallback)  
**Body Font:** Barlow (with system UI and sans-serif fallback)  
**Label/Mono Font:** Barlow Condensed; numeric readouts use tabular figures rather than a separate monospace face.

**Character:** Condensed type gives the interface the fast vertical scan of a timing tower. Barlow body copy keeps caveats and method language calm, legible, and distinct from competitive state.

### Hierarchy

- **Display:** Bold, tightly spaced, and compact; used for route titles, decisions, classification, and major race state.
- **Headline:** Condensed semibold; used for section questions and panel groups.
- **Title:** Condensed semibold; used for cards, controls, and timing rows.
- **Body:** Regular with open line height; used for explanations, limitations, and evidence context.
- **Label:** Condensed semibold with restrained tracking; used for provenance, field labels, compact navigation, and units.

### Named Rules

**The Numbers Scan Rule.** All metrics, timing, ranks, laps, and probabilities use tabular figures and align to a stable edge.

**The Caveat Stays Human Rule.** Limitations and provenance explanations use readable sentence case, never compressed all-caps telemetry copy.

**The No Eyebrow Rule.** No small, muted, letter-spaced, all-capitals label sits over anything to name it: not over a title, not over a figure, not over a panel, not over a column, not in front of a search result. Such a label is sentence case at its natural spacing, at the size it already had (`.label` and the table heads are set this way), and `tests/typography.test.ts` fails on a new one. Nothing is named an eyebrow in the code either: a panel's `context` is a plain line *under* its title, for what the title does not say (the phase of the race, the season, the scope), and it is left out when it only repeats the title. A dateline or a verdict line goes under the heading it describes, never over it, and the same test fails on a label directly above a heading. Capitals stay where they are the thing itself and carry weight on their own: a driver's name or code, a heading, a button, a tab, a chip, a banner. That is the broadcast voice, and it is not a label over something else.

**The No Kicker Rule.** A page title has no small label above it. The label ("The model", "Circuits", "Drivers") only repeated the page's own name, and a small tracked label over a big heading is the most recognisable mark of generated landing-page design. A page opens with its title and one plain paragraph; where the label carried something real (a place you can go back to) it is a breadcrumb, a link with an arrow in plain muted text, and where it carried a fact the fact moved into the sentence it belongs to.

## Layout

The shell is a route-level timing strip over a matte working field. Reading routes use one-question sections and progressive disclosure; operating routes may use dense split workspaces with the primary state, controls, and timing tower visible together. Hairline grids establish alignment before containers do.

Content uses fluid gutters and bounded wide canvases rather than a single article width. At narrow widths, multi-column workspaces collapse in evidence order, control rows wrap or scroll deliberately, and dense classifications receive an explicit accessible horizontal region. Core evidence remains available from 320 pixels upward.

## Elevation & Depth

Carbon tonal steps, hairlines, inset rules, and occasional translucent tower layers establish depth; cards do not float above the page. Conventional drop shadows are limited to the floating navigation (the bar, the phone dock and the lists that open from them) and transient overlays, while signal glow is reserved for the literal start-light loading motif.

### Named Rules

**The Wall, Not Cards Rule.** Build hierarchy with shared edges and tonal layers before introducing a detached container.

**The No Ambient Glow Rule.** Do not use neon halos or persistent luminous telemetry; the start-light state is the narrow exception.

## Shapes

Paladin is rectilinear and mechanically aligned. Panels, fields, tables, chips, segmented controls, and maps use square corners and one-pixel borders. The primary button carries the system's characteristic clipped trailing corner; provenance uses a small circular dot because it is status punctuation, not a container shape. The shield mark may use its established chamfer.

The one exception is navigation, because it is the one thing that floats above the page: the top bar and the phone dock are pills, and the More list has large rounded corners. They are also the one place the system uses glass: a frosted, glossy surface (see Navigation).

## Components

### Buttons

- **Shape:** Square, with the primary action clipping its lower trailing corner.
- **Primary:** Signal-red fill, white condensed uppercase label, generous horizontal inset, and a comfortable minimum target height.
- **Hover / Focus:** Brighten slightly on hover; use the global visible white focus outline. Active state may move by one pixel when reduced motion is not requested.
- **Ghost:** Transparent carbon surface with an inset strong hairline; the border and label rise to timing white on hover.

### Chips

- **Style:** Square outlined choice with condensed uppercase text; inactive state is steel on transparent carbon.
- **State:** Selected chips invert to timing white on carbon-page text. Chips are for bounded filters or choices, not evidence labels.

### Cards / Containers

- **Corner Style:** Square.
- **Background:** Carbon panel tones selected by hierarchy.
- **Shadow Strategy:** Flat; use hairline borders and shared-edge grids.
- **Internal Padding:** Use the established panel spacing scale and reduce density only when content needs it.

### Inputs / Fields

- **Style:** Carbon-panel fill, strong hairline border, condensed label/value treatment, and tabular numeric values.
- **Focus:** Retain the global visible outline and promote the field border to timing white.
- **Error / Disabled:** State must be written in text; disabled controls reduce emphasis but remain legible.

### Navigation

The global shell is a floating capsule in three zones: the brand, five destinations, and the tools (search). On a wide screen the destinations sit on the capsule's true centre. The current destination is marked quietly: a tonal pill (a tint of the ink) slides to it and its text rises from muted to ink. The same pill sits under the current slot of the phone dock. The capsule is frosted glass in the manner of a phone's system chrome: a blurred view of the page behind it (a 12px blur, and no saturation boost: the original 24px blur with a 180% saturate pass was the single most expensive thing on the page, and made the page slow to repaint, with hitches of up to 0.4 seconds; at 12px it runs smoothly), a soft sheen down from the top edge, a bright upper edge and a shadow that lifts it. In the light theme it is whiter than the page and has a darker edge, so it stands off the paper; in the dark theme it is a deep smoked glass. Every control in it is 40px tall, so the row reads as one line.

**The Legible Glass Rule.** The glass is see-through, and kept dense enough only so that a label stays readable over whatever scrolls beneath it: a 62% tint (it began at 74% and 80%, which read as opaque). To make up for the thinner tint, the idle labels use the brighter of the two greys. The sheen is a separate layer (so the rendered-contrast audit can still measure the labels), and where the browser cannot blur, or the reader has asked for less transparency, the bar, the dock and the More list become solid surfaces of the same shape. Glass is for the floating navigation only. The glass of the capsule and the dock is a layer behind them, not the capsule itself: a blurred surface inside another one can only see as far as the outer one, so with the blur on the capsule the dropdown that opens from it had to be solid (the page showed through it sharp, as ghost text behind the labels). With the blur on a layer behind, the **More** list is glass too, a little denser than the bar (86% dark, 90% light) because it holds text, and it blurs the page behind it. For the same reason nothing that must cover the screen lives inside the bar, so the search palette is mounted on the body.

**The More list opens by itself on a desktop.** When a mouse rests on it (after 70ms of intent, so a pointer passing over it does not trigger it) it drops down; a transparent bridge above it keeps it open while the pointer crosses the gap, and it closes 220ms after the pointer has left both. Clicking it while it is open that way keeps it open; a second click closes it. A touch has no hover, so on a phone it is a plain tap, and the keyboard is unchanged (Enter opens it, Escape closes it and returns focus to the button). Its rows are text only, a title with a line under it and no icon tile: the current page is a tonal pill, as in the bar.

Pages that belong to a destination without a place in the bar (Method, History graph, Season league, the Driver and Circuit archives) live under **More**, a disclosure whose list names the page you are on; the destination that owns the page stays marked in the bar. On a phone the bar carries only the brand and the tools and slides away while reading, and the dock (five destinations and More) stays at the thumb. Hover and active states use tonal or text contrast, with red reserved for the current signal rather than decorating every link.

**One bar, never two.** On a phone the capsule hides after 24px of scrolling down and returns only on a pull of 56px upward, counted from the last change of direction, so the small slips of a thumb never toggle it. A page's own section strip (Circuit, Grid, Your call on a race; the sections of the method and model pages) is the capsule's twin while it sits in the page: a floating glass pill of the same material, shape and widest width. When it reaches the bar it does **not** dock under it as a second bar. It melts into the first: the strip fades and lifts toward the bar while the bar grows a chip beside the logo, in the same tonal pill the bar uses to mark the current page, naming the section the reader is in. The chip is a dropdown listing every section (the bar's glass again, a little denser because it holds text), which opens by itself when a mouse rests on it and on a tap; choosing a section goes there and closes it. Scrolled back up, the strip returns and the chip goes. On a tablet, where the bar has no room to spare, the chip is just its icon. On a phone the bar hides while reading, so the strip is the way around then: it comes back, alone, 8px from the top, and gives way to the chip again when the bar returns; there are never two bars on screen at once. (Earlier the strip docked 8px under the bar and followed it with a transform, which looked like two navbars stacked.) The page publishes its sections and the bar reads them from one small store (`ui/src/lib/sectionNav.ts`). Behind the bar, the page fades to its own colour over the top edge of the screen, so what scrolls up under it dissolves into it. **Device edges:** the bar, the dock, the search panel and the page keep clear of a notch on either side (a phone on its side) and of the home indicator; in forced-colours modes (Windows High Contrast) the glass becomes plain boxes with an edge in the system's text colour and the theme switch keeps its own drawing.

### Search

Search is a palette over a dimmed screen, opened from the bar's search icon, `/` or Ctrl+K. It is mounted on the body so the dimming always covers the whole screen. On a phone it hugs the top of the screen and is sized to what the on-screen keyboard leaves (so the list is never behind the keys), the page behind it does not scroll, the close control is a 44px cross, and nothing names a key: the "Up and down to move" line and "Esc" appear only where there is a keyboard (`(hover: hover) and (pointer: fine)`), as does the page's own "Press / to search" line (`.keyboard-only`). The field has no box of its own, so instead of the global ring floating around empty space the row carries the focus mark, a 2px ink rule under it.

**The palette moves, and only as the rest of the site does.** It fades and settles in (the scrim in 140ms, the panel rising 10px over 200ms on `--ease-out`) and fades out in 120ms instead of vanishing; while it leaves it is out of reach (clicks go through to the page, and it is hidden from assistive technology, because focus has already returned to the button). Only opacity and transform move, so the compositor does it and a phone still drawing the page behind cannot make it stutter, and nothing overshoots. One highlight sits behind the active row and glides to the row the keys or the pointer choose; a new search sends it to the first row at once, because the list it would travel across has gone. The list glides between heights as the search narrows or widens (its scrollbar held back while it does), has a thin scrollbar with no arrow buttons, and never scrolls smoothly under the arrow keys (held down, they repeat faster than a smooth scroll can follow). Focusing the field never moves the page, and the search icon answers a press at once (it gives a little under the finger before the palette has opened). With reduced motion none of it moves and the palette goes at once. `tests/accessibility.test.ts` pins the curves, the properties and the timings, and `release.spec.ts` drives the keys.

The back-to-top button is a small glass circle that matches the dock, never a heavy outlined disc over the content.

### Footer

One quiet band on the Tower surface and no more: the brand and the one paragraph about the project on the left, and the way around the site on the right in three short groups (Explore, Archives, Understand). The data sources and the no-endorsement notice are not repeated here; they live on the model page, where the numbers they apply to are explained. No lockup, no second logo, no decoration; links are text that rises to ink on hover. On a phone the footer itself (not the page body) leaves room for the dock, so its surface runs to the bottom edge of the screen instead of ending in a strip of page colour.

### Favicon

The logo's triangle in white on a square of the logo's own blue (`#1800ad`, 12.8:1), nothing else. The artwork is hairline line work, which is gone at 16px, so each size draws it with its lines thickened to about 0.8 of a pixel (a frame drawn for each size in the `.ico`, not one image scaled); the pieces stay cut out of the triangle, so it reads as the same mark and not a solid wedge. It is drawn from the supplied path, not redrawn, and sits a little above centre because a triangle's weight is low in its box.

### Icons

One outline icon set (Tabler Icons, MIT), on a 24px grid, drawn at one stroke weight (1.75) with round caps and joins, and no fills. Consistency is the point: icons from one family share weight, corner radius and optical size, which is what separates a designed interface from a collection of pictures. An earlier hand-drawn set with soft tonal fills behind the lines read as generated, and was replaced. An icon is a name in `Icon.tsx` that points at the best drawing the set has for that meaning; to change one, choose another icon from the same set, and never draw one by hand.

### Provenance Tags

Tags are inline evidence labels with a small semantic dot. Model output uses red, historical record uses steel, illustrative or simulated material uses amber, and user input uses white. The wording is mandatory; the dot alone is never the label.

**Reference** is the seventh kind: a fact from public sources that is not in the race dataset, such as who ran a team (`ui/src/data/team-principals.json`, written by hand, every entry linked to its sources and stamped with the date it was checked). It is quiet like the record, with a *square* dot where the others have a round one, so the difference is a shape as well as a colour. A panel that mixes the two says so with both tags (`["record", "reference"]`), and a reference list says in words, beside it, that it is not part of the dataset.

### Drivers and Teams

A driver's page and a team's page describe, in plain sentences, what the record says, and say nothing the record does not. **The writing is a function of the data** (`features/drivers/profile.ts`, `features/teams/teamFacts.ts`): numbers and places, no adjective that grades a person, the surname as the subject throughout (the data says nothing about anyone's pronouns, so no sentence uses one; a test fails on one), and a surname such as "de Vries" still opens a sentence in capitals. Small counts are words ("three seasons") and larger ones are numbers. **Points mean one thing:** the championship's when the standings have them (they include any sprint points), the race results' otherwise, never one in one sentence and the other in the next; where the two differ (Norris, 2024: 374 and 344) the page says where the second figure comes from. **A claim is only as wide as its data:** a team's results are given "in those seasons", never "while in charge", because a principal who left mid-season did not lead the whole season; a person who led two teams links to the other; a team whose leader was a *team representative* says so and never calls them a principal.

**Who ran a team is a reference, and looks like one.** It carries the *Reference* tag, its sources are linked beside each person, a note says in words that it is not part of the race dataset and when it was last checked, and the titles are as published. A team's leader appears with their flag (a Luxembourg flag was added for it). Searching a principal's name ("Toto") finds a *Leader* result that opens their team, with the team itself listed after it. Pages of people stay in the same plain voice as the rest of the site: nothing is invented to make a person sound more interesting than the numbers make them.

**A team has a tile, as a driver has a portrait** (`components/TeamBadge.tsx`): the team's colour with its mark on it, on every team card and at the head of a team's page. The marks are registered trademarks, so only files with a free licence for the file itself are bundled, each listed with its source, author and terms in `data/team-logos.json` and credited under *Logo credits* on the Teams page (a test fails on an entry with no source, author or licence, or no file). Mercedes, Ferrari, Red Bull, McLaren, Aston Martin and Alfa Romeo come from Simple Icons (CC0); Alpine, Haas, Williams and Sauber from Wikimedia Commons. RB and AlphaTauri have no free file, so their tiles show a three-letter code, written by hand in `lib/teamMark.ts` and unique per team. **Every mark is drawn in one colour**, white or black whichever reads on the team's colour (the same choice the code makes), so a team with a logo and a team with a code look like one set, and a dark mark never disappears on a dark page. A team with no listed file never gets a made-up logo.

**A weekend is one card, not a line per fact.** On a driver's page, "Weekends to look at" lists each race that earned a mention in calendar order: the circuit's flag (decorative: the country is written beside it), the round and country, the grid slot and the finish as numbers (a podium finish takes its medal colour, as in the results), and a chip in words for why it is listed (Win, Pole, Best finish, Gained or Lost N places, Retired). A win from pole is one card with two chips. A gain or a loss is never told by colour alone, and the loss is not drawn in red, which the site keeps for the model.

### Timing, Circuit, and Race Control

**Event marks.** A race event is drawn with a small original mark beside its word (`ui/src/components/EventMark.tsx`): the start lights on their gantry, a wheel for a pit stop, an arrow going past another for an overtake, a yellow flag for an incident, a cross in a ring for a retirement, the chequered flag for the finish. The word is always written, so the mark helps you find the line and never carries the meaning alone. Race Lab is a simulation and labels every event as simulated, so its incident is shown as the yellow flag a real one would bring out. The decision studio shows what was recorded, and the record does not say why a field slowed (a safety car, a red flag, rain), so **no recorded event is ever drawn as a flag**; `tests/eventMarks.test.ts` fails if one is. Only the two flags have colours of their own; the rest take the colour of their text.

Timing rows align position, competitor, compound/state, and gap in a stable grid. Circuit geometry is checked data; overlays identify unavailable information rather than inventing it. In Race Lab, the circuit, timing tower, structured event stream, strategy calls, forecast, and classification all read from canonical simulation state. Car movement is one bounded transition per lap and is removed under reduced motion.

### Circuit Map and Car

The map is a built track, not a line: a close contact shadow, a slate run-off band (or the sector colours when sectors are on), white track limits, weathered tarmac (a fine speck and broad lighter patches) with a soft line worn into it, red and white kerbs on the inside of the sharp turns, a bridge where the lap crosses itself, a starting grid behind the line, direction chevrons on the straights, the sector timing lines, and a chequered start line across the asphalt. There is no painted centre line: a circuit has none, and a dashed one made it read as a road.

The car is an original open-wheel drawing seen from above, in the proportions of a real one (about 2.8 times as long as it is wide, never as wide as the track). It has the parts a car has: a front wing of three elements with end plates and outwash footplates, a nose, four tyres with their rims, suspension arms, the floor showing between the wheels with its vanes, sidepods with intakes and vents, mirrors, an airbox, a shark fin, the halo and the driver's helmet, and a rear wing with its flap, end plates, beam wing and light. The bodywork is shaded as a curved surface (lit down the middle, darker at the edges) and a ground shadow sits it on the track. It carries no real team's livery or marking.

- **Detail is styling of real geometry, never a survey.** Kerbs go where the sampled outline turns by more than about 23 degrees, on the inside of the turn (a chicane that changes sides puts a kerb on each side). The worn line follows the outline's curvature: inside at the apex, a touch wide on the way in and out. A bridge is drawn only where the sampled outline genuinely crosses itself at more than a graze (only Suzuka does), with the later pass over the earlier, as on the real bridge. The grid is drawn only where the start straight is long enough to hold six rows. All of it is worked out from the 360 samples in `ui/src/lib/mapDetail.ts`, so it follows each circuit's real corners (Suzuka's 18 corners give 14 runs of kerb, because its esses merge) without claiming where a kerb, a patch of rubber or a bridge actually sits. A layout with no samples (outline only) gets none of it. Gravel, grass and pit lane are not drawn, because nothing in the data says where they are.
- **Thumbnails stay plain.** The detail, the grain and the shadow are for the full map (weight under 1.6). Small renders keep the flat track so they stay legible and cheap.
- **Sector colours and kerbs sit together.** With sectors on, the band carries the sector colours and the kerbs lie just inside the white limit, so each reads on its own.
- **A bridge is drawn above the kerbs and the track beneath it.** The deck repaints only the band, the limits and the asphalt; the worn line and the DRS stripe are drawn once for the whole lap, after it, and left out where they run under the deck. Its shadow is masked to the track beneath, so on a light page it never smudges the ground beside it.
- **Filters and masks cover the whole map** (`filterUnits` and `maskUnits` set to `userSpaceOnUse`). The default region is the bounding box of the path's geometry, which excludes its stroke, and clips a wide track to its centre line.
- **The car is sized as a marker, not to scale.** A real car is under half a track's width long; drawn that way it would be too small to see. It is scaled so its wings sit well inside the white limits (1.1 on the home map; `tests/lap.test.ts` fails if it grows past 9 of the asphalt's 10 half-width units), and each car carries its own gradient ids, so many cars on one map never share one.
- **Matte, not luminous.** The starting grid is a thin, dull line (`#aeb4bc` at 40%), as paint is, and the track's shadow is a close contact shadow just past its edge, not a wide blur round it. A wide blur read as a grey halo, which is a glow by another name.
- **The home car is moved by the browser, not by script.** It lives in its own layer laid over the map, and two Web Animations of its `transform` and nothing else move it: a launch from the first grid slot (the distance grows as the square of the time, so the speed builds in a straight line and ends at exactly the cruising speed), then the lap at an even pace. Transform animations run on the compositor, so a busy page (a phone drawing the map, a script, a scroll) cannot make the car stutter. The points come from the drawn curve at equal distances (`ui/src/lib/lap.ts`), and the heading is that of a chord a few points either side, unwrapped, so the car turns continuously instead of snapping to a new angle at every sample as `pointAt`'s did. Timing is linear throughout: nothing eases past its target. It waits where it is while its map is off screen (`IntersectionObserver`) and goes on from there. `release.spec.ts` scrubs both animations through a whole lap and fails on an uneven pace, a snapped heading, a kick at the handover, or a car that keeps going off screen.
- **Motion is one fade.** The detail fades in once the track has drawn, and not at all under reduced motion. The home car is the only thing on the map that keeps moving.

## One Palette

The site is dark and only dark. There was a light theme and a day/night switch; both are gone, so there is one palette to keep
accessible and one look to keep consistent. `color-scheme: dark` is set, so native controls and scrollbars match, and the browser's
own chrome (a phone's address bar) takes `theme-color`. Nothing runs before first paint to choose a theme, and a theme saved by an
older version of the site is ignored.

| Role | Value |
| --- | --- |
| Page / Tower / Panel / Raised panel | `#0a0b0e` / `#06070a` / `#101318` / `#161a21` |
| Ink / Steel / Muted | `#f4f4f2` / `#c5cad1` / `#98a0ab` |
| Signal red / red as text | `#e10600` / `#ff5a4d` |
| Control border | `#707987` |
| Hit green / Amber | `#3ddc84` / `#ffb020` |
| Gold / Silver / Bronze (text and fill) | `#f2c53d` / `#c9d0d8` / `#d08a4e` |
| Text on a medal fill | `#0a0b0e` |

- The logo mark is vector and takes `--color-brand` (a lighter tint of the logo's blue, because the drawn one would be 1.5:1 on this page); the wordmark is drawn in `currentColor`. The bar carries the mark alone; the footer pairs it with the wordmark.
- Team colours are identification. Text on a team colour is chosen for that colour (`onColour`).

### Named Rules

**The Control Rule.** Anything you can press or type into has a border you can see: `--color-control`, at least 3:1 against every
surface. Hairlines (`--color-line`, `--color-line2`) are decoration and are deliberately fainter, so a control never
looks like a divider.

**The Token Rule.** Colour in code is a token (`var(--color-ink)`), never a neutral hex, so the palette has one source. The few
literals that remain are fixed on purpose: team colours, the chequered flag, a marshal's yellow flag, the dark car sprite, and the always-dark share card.

**The Floor Rule.** No text is smaller than 12px. Provenance tags, which say what kind of information a panel shows, are 12.8px.
Nothing you can press is smaller than 24px, and nearly everything is 44px on a phone.

### What is checked, and how

- `tests/palette.test.ts` reads the real tokens from `index.css` and asserts WCAG AA for every text colour on every surface, 3:1 for
  control borders and signal red, 4.5:1 for white on the red button and for text on each medal. It also fails if a second theme, a switch or a stored theme choice
  comes back, and if a neutral hex returns to the code.
- `e2e/release.spec.ts` measures the contrast of every run of text on the rendered pages, on a phone and a desktop,
  compositing translucent backgrounds. The measuring code was checked by planting a bad colour and confirming it is caught.
- `tests/typography.test.ts` fails on any text below 12px. The e2e suite fails on any target under 24px.

## Do's and Don'ts

### Do:

- **Do** label every analytical panel as model output, historical record, illustration/simulation, or user input.
- **Do** separate pre-race information, approximate decision intelligence, and historical outcome in both layout and language.
- **Do** use hairlines, tabular alignment, and tonal carbon layers to make dense material scannable.
- **Do** preserve visible focus, native control semantics, reduced-motion behavior, and complete evidence from 320 pixels upward.
- **Do** keep exports and share actions real, reproducible, and explicit about assumptions and limitations.
- **Do** check the screens people really use: phones from 320px to 430px and on their side (with a notch), tablets, laptops and monitors up to 2560px, and text at 200% (`ui/e2e/devices.spec.ts`).

### Don't:

- **Don't** use glassmorphism anywhere but the floating navigation, generic dashboard cards, neon borders, ambient animation, or decorative telemetry noise.
- **Don't** imply win probability, calibrated finishing order, live strategy optimisation, or causal knowledge the model does not provide.
- **Don't** let simulation motion, timing, classification, and the structured event record disagree.
- **Don't** fabricate circuit detail, missing data, causal explanations, metrics, standings, or model behaviour. Kerbs, chevrons, the worn line, the bridge and the grid are derived from the outline's own turning and crossings and never drawn where there is no outline; gravel, grass and pit lane are not drawn at all.
- **Don't** use colour alone to distinguish provenance, status, competitor, or interaction state.
- **Don't** make anything bounce. No easing curve overshoots its target and springs back (every `cubic-bezier` keeps both control-point heights between 0 and 1); motion eases out and stops dead.
