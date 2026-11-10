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

Carbon tonal steps, hairlines, inset rules, and occasional translucent tower layers establish depth; cards do not float above the page. Conventional drop shadows are limited to transient navigation overlays, while signal glow is reserved for the literal start-light loading motif.

### Named Rules

**The Wall, Not Cards Rule.** Build hierarchy with shared edges and tonal layers before introducing a detached container.

**The No Ambient Glow Rule.** Do not use neon halos or persistent luminous telemetry; the start-light state is the narrow exception.

## Shapes

Paladin is rectilinear and mechanically aligned. Panels, fields, tables, chips, segmented controls, and maps use square corners and one-pixel borders. The primary button carries the system's characteristic clipped trailing corner; provenance uses a small circular dot because it is status punctuation, not a container shape. The shield mark may use its established chamfer.

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

The global shell is a compact timing strip with the active route exposed in text. Desktop navigation remains horizontal; mobile navigation becomes an operable menu and bottom route bar. Hover and active states use tonal or text contrast, with red reserved for the current signal rather than decorating every link.

### Provenance Tags

Tags are inline evidence labels with a small semantic dot. Model output uses red, historical record uses steel, illustrative or simulated material uses amber, and user input uses white. The wording is mandatory; the dot alone is never the label.

### Timing, Circuit, and Race Control

Timing rows align position, competitor, compound/state, and gap in a stable grid. Circuit geometry is checked data; overlays identify unavailable information rather than inventing it. In Race Lab, the circuit, timing tower, structured event stream, strategy calls, forecast, and classification all read from canonical simulation state. Car movement is one bounded transition per lap and is removed under reduced motion.

## Do's and Don'ts

### Do:

- **Do** label every analytical panel as model output, historical record, illustration/simulation, or user input.
- **Do** separate pre-race information, approximate decision intelligence, and historical outcome in both layout and language.
- **Do** use hairlines, tabular alignment, and tonal carbon layers to make dense material scannable.
- **Do** preserve visible focus, native control semantics, reduced-motion behavior, and complete evidence from 320 pixels upward.
- **Do** keep exports and share actions real, reproducible, and explicit about assumptions and limitations.

### Don't:

- **Don't** use glassmorphism, generic dashboard cards, neon borders, ambient animation, or decorative telemetry noise.
- **Don't** imply win probability, calibrated finishing order, live strategy optimisation, or causal knowledge the model does not provide.
- **Don't** let simulation motion, timing, classification, and the structured event record disagree.
- **Don't** fabricate circuit detail, missing data, causal explanations, metrics, standings, or model behaviour.
- **Don't** use colour alone to distinguish provenance, status, competitor, or interaction state.
