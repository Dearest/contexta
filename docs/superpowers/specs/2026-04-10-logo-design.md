# Contexta Logo Design Spec

## Concept: Mirror Reflection — A reflects into 文

A single icon that tells the translation story: the Latin letter "A" in the upper half reflects into the Chinese character "文" in the lower half, separated by a subtle water-line divider.

## Use Cases

- Browser extension icon (16/32/48/96/128 px)
- Popup header and Options page display

## Visual Spec

### Canvas
- 128×128 rounded square, corner radius 24
- Linear gradient fill: top-left `#065f46` → bottom-right `#059669` (existing brand gradient)

### Upper Half — Letter "A" (y ≈ 20–64)
- White (`#FFFFFF`), bold geometric sans-serif
- Constructed from: two angled strokes forming a triangle + one horizontal crossbar
- Centered horizontally, vertically positioned above the midline

### Divider Line (y = 64)
- Horizontal line, color `#a7f3d0` (brand border green)
- Stroke width ~1px, fades to transparent at both ends (gradient opacity mask)
- Represents the "water surface" abstraction

### Lower Half — Simplified "文" (y ≈ 64–108)
- White with reduced opacity (~0.5) to create "underwater reflection" effect
- Extremely simplified geometric strokes:
  - One horizontal stroke (top of 文)
  - Two crossing diagonal strokes (the 撇捺 of 文)
  - Bottom dot omitted for clarity at small sizes
- Slightly narrower than upper "A" to simulate perspective shrink of a reflection

### Small Size Degradation
- At 32px and below, divider and 文 details naturally blur into an abstract white glyph on green — still clean and recognizable
- No separate small-size variant needed; geometric construction provides sufficient tolerance

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| gradient-start | `#065f46` | Background top-left |
| gradient-end | `#059669` | Background bottom-right |
| foreground | `#FFFFFF` | Upper "A" |
| foreground-muted | `rgba(255,255,255,0.5)` | Lower "文" reflection |
| divider | `#a7f3d0` | Water-line separator |

## Deliverables

1. `assets/icon.svg` — source vector (128×128 viewBox)
2. `public/icon/{16,32,48,96,128}.png` — rasterized from SVG for extension manifest

## Design Principles

- One shape, one story: "A" becomes "文" through reflection
- Geometric, not calligraphic — all strokes are clean lines
- Brand continuity: same green gradient as existing UI
- Small-size resilient: reads as abstract symbol when details are lost
