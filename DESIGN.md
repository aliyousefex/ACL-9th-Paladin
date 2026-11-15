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

The one exception is navigation, because it is the one thing that floats above the page: the top bar, the phone dock and the theme switch are pills, and the More list has large rounded corners. They are also the one place the system uses glass: a frosted, glossy surface (see Navigation).

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

The global shell is a floating capsule in three zones: the brand, five destinations, and the tools (search and the theme switch). On a wide screen the destinations sit on the capsule's true centre. The current destination is marked quietly: a tonal pill (a tint of the ink, so it works in both themes) slides to it and its text rises from muted to ink. The same pill sits under the current slot of the phone dock. The capsule is frosted glass in the manner of a phone's system chrome: a blurred, saturated view of the page behind it, a soft sheen down from the top edge, a bright upper edge and a shadow that lifts it. In the light theme it is whiter than the page and has a darker edge, so it stands off the paper; in the dark theme it is a deep smoked glass. Every control in it is 40px tall, so the row reads as one line.

**The Legible Glass Rule.** The glass is kept dense (74% in the dark theme, 80% in the light) so a label stays readable over whatever scrolls beneath it, the sheen is a separate layer (so the rendered-contrast audit can still measure the labels), and where the browser cannot blur, or the reader has asked for less transparency, the bar, the dock and the More list become solid surfaces of the same shape. Glass is for the floating navigation only.

Pages that belong to a destination without a place in the bar (Method, History graph, Season league, the Driver and Circuit archives) live under **More**, a disclosure whose list names the page you are on; the destination that owns the page stays marked in the bar. On a phone the bar carries only the brand and the tools and slides away while reading, and the dock (five destinations and More) stays at the thumb. Hover and active states use tonal or text contrast, with red reserved for the current signal rather than decorating every link.

### Footer

One quiet band on the Tower surface and no more: the brand and the one paragraph about the project on the left, and the way around the site on the right in three short groups (Explore, Archives, Understand). The data sources and the no-endorsement notice are not repeated here; they live on the model page, where the numbers they apply to are explained. No lockup, no second logo, no decoration; links are text that rises to ink on hover.

### Favicon

The rearing horse of the logo, in ink on the page's near-black square, nothing else: no red tile, no frame. It is traced from the logo into one vector outline, so it is a drawing rather than a shrunken bitmap and stays recognisable at 16px; the same outline draws every size.

### Theme Switch

One light/dark switch. It is a pill track with a faint sun at one end and a moon at the other and a glossy knob that slides between them with a touch of spring, stretching while it is pressed, its icon turning from sun to moon as it crosses. It is a real switch (Space and Enter flip it) and always shows the theme on screen. Until it is flipped the site follows the device, live; flipping it saves an explicit choice. There is no third control for "match my device": the default is that, and a reader who has chosen is choosing.

The change itself is a wipe: the incoming theme is revealed through a radial mask that grows from the knob, with the last 180px feathered so it spreads like a tide rather than a cut-out. Browsers without view transitions get a 320ms colour fade instead. Under reduced motion the knob, the pills and the wipe all jump instead of moving, and nothing animates before the reader has first used the switch.

### Provenance Tags

Tags are inline evidence labels with a small semantic dot. Model output uses red, historical record uses steel, illustrative or simulated material uses amber, and user input uses white. The wording is mandatory; the dot alone is never the label.

### Timing, Circuit, and Race Control

Timing rows align position, competitor, compound/state, and gap in a stable grid. Circuit geometry is checked data; overlays identify unavailable information rather than inventing it. In Race Lab, the circuit, timing tower, structured event stream, strategy calls, forecast, and classification all read from canonical simulation state. Car movement is one bounded transition per lap and is removed under reduced motion.

## Light Theme

The same system on a warm paper sheet, for daylight, print and a classroom projector. It is not an inversion: surfaces keep
their roles (**Tower** is the deepest, **Panel** the raised one), colour keeps its meaning (red is the model, green is a hit),
and every pair is checked.

| Role | Dark | Light |
| --- | --- | --- |
| Page / Tower / Panel / Raised panel | `#0a0b0e` / `#06070a` / `#101318` / `#161a21` | `#f3f2ee` / `#e9e8e3` / `#ffffff` / `#f8f7f4` |
| Ink / Steel / Muted | `#f4f4f2` / `#c5cad1` / `#98a0ab` | `#0a0b0e` / `#2c333c` / `#545c67` |
| Signal red / red as text | `#e10600` / `#ff5a4d` | `#d10600` / `#b40700` |
| Control border | `#707987` | `#6a727d` |
| Hit green / Amber | `#3ddc84` / `#ffb020` | `#09723a` / `#8a5600` |
| Gold / Silver / Bronze (text and fill) | `#f2c53d` / `#c9d0d8` / `#d08a4e` | `#7d5e00` / `#5b6470` / `#9a5320` |
| Text on a medal fill | `#0a0b0e` | `#ffffff` |

- The theme is the `data-theme` attribute on `<html>`: `dark` (the default) or `light`. The visitor's choice is **match my device**,
  **light** or **dark**, saved in this browser. `index.html` resolves it before the first paint, so there is never a flash of the
  wrong theme, and `src/lib/theme.ts` keeps it current, including when the device switches while the choice is "match my device".
- The browser's own chrome (a phone's address bar) follows the page through `theme-color`, and native controls and scrollbars follow
  through `color-scheme`.
- The raster horse logo is pale, so it is inverted on the light page; the wordmark is drawn in `currentColor`.
- Team colours are identification, not theme, and are the same in both. Text on a team colour is chosen for that colour.

### Named Rules

**The Control Rule.** Anything you can press or type into has a border you can see: `--color-control`, at least 3:1 against every
surface in both themes. Hairlines (`--color-line`, `--color-line2`) are decoration and are deliberately fainter, so a control never
looks like a divider.

**The Token Rule.** Colour in code is a token (`var(--color-ink)`), never a neutral hex, or the other theme cannot recolour it. The few
literals that remain are fixed on purpose: team colours, the chequered flag, the dark car sprite, and the always-dark share card.

**The Floor Rule.** No text is smaller than 12px. Provenance tags, which say what kind of information a panel shows, are 12.8px.
Nothing you can press is smaller than 24px, and nearly everything is 44px on a phone.

### What is checked, and how

- `tests/theme.test.ts` reads the real tokens from `index.css` and asserts WCAG AA for every text colour on every surface, 3:1 for
  control borders and signal red, 4.5:1 for white on the red button and for text on each medal, in both themes. It also fails if a
  colour exists in one theme and not the other, and if a neutral hex returns to the code.
- `e2e/release.spec.ts` measures the contrast of every run of text on nine rendered pages, in both themes, on a phone and a desktop,
  compositing translucent backgrounds. The measuring code was checked by planting a bad colour and confirming it is caught.
- `tests/typography.test.ts` fails on any text below 12px. The e2e suite fails on any target under 24px.

## Do's and Don'ts

### Do:

- **Do** label every analytical panel as model output, historical record, illustration/simulation, or user input.
- **Do** separate pre-race information, approximate decision intelligence, and historical outcome in both layout and language.
- **Do** use hairlines, tabular alignment, and tonal carbon layers to make dense material scannable.
- **Do** preserve visible focus, native control semantics, reduced-motion behavior, and complete evidence from 320 pixels upward.
- **Do** keep exports and share actions real, reproducible, and explicit about assumptions and limitations.

### Don't:

- **Don't** use glassmorphism anywhere but the floating navigation, generic dashboard cards, neon borders, ambient animation, or decorative telemetry noise.
- **Don't** imply win probability, calibrated finishing order, live strategy optimisation, or causal knowledge the model does not provide.
- **Don't** let simulation motion, timing, classification, and the structured event record disagree.
- **Don't** fabricate circuit detail, missing data, causal explanations, metrics, standings, or model behaviour.
- **Don't** use colour alone to distinguish provenance, status, competitor, or interaction state.
