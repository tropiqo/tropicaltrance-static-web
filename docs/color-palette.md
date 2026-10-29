# Tropical Trance color palette

This document records the current near-black palette experiment. The values are defined centrally in [`src/styles/tokens.css`](../src/styles/tokens.css); component styles should use those tokens instead of introducing one-off colors.

## Dark surfaces

| Role | Token | Value | Use |
|---|---|---|---|
| Canvas | `--color-canvas` | `#080A09` | Main page background |
| Surface | `--color-surface` | `#111513` | Section surfaces and navigation hover states |
| Raised surface | `--color-surface-raised` | `#1B201D` | Decorative background stage |
| Video-control overlay | `--color-overlay` | `rgb(8 10 9 / 92%)` | Dark overlay behind video controls |

## Typography and accents

| Role | Token | Value | Use |
|---|---|---|---|
| Paper / primary text | `--color-paper`, `--color-text` | `#F6F0DE` | Cream headings and body text |
| Muted text | `--color-muted` | `#B9CFC1` | Secondary text on dark surfaces |
| Ink | `--color-ink` | `#080A09` | Text and icons on light surfaces and accents |
| Muted ink | `--color-ink-muted` | `#46615B` | Secondary text on paper-colored surfaces |
| Lime accent | `--accent-citrus` | `#B9E769` | Focus ring, highlights, and primary actions |
| Coral accent | `--accent-coral` | `#FA947B` | Warm emphasis and brand detail |

## Borders

| Role | Token | Value |
|---|---|---|
| Dark-surface border | `--color-border` | `#59746B` |
| Paper-surface border | `--color-border-paper` | `#A7B5A6` |

Automated contrast checks cover the current text and focus-color pairings. Review the rendered palette visually before promoting it beyond development.
