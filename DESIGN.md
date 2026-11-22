# Design System

## Direction

Style name: Строгий минимализм.

ShiftReport follows the local CyberInfo visual language: a near-black operational interface, warm white text, acid-green signal color, square framed panels, compact labels, and a high-density information rhythm. The Dashboard is mobile-first and keeps the data visible before decoration.

## Color

- #090909 page background
- #101010 panel surface
- #292929 structural border
- #F1EFE8 primary text
- #747474 secondary text
- #BAFF2B live state and positive values
- #151515 active surface
- #A96969 destructive or negative state

## Type

- The interface uses a clean sans-serif voice like CyberInfo's Manrope setup for headings, values, controls, and operational labels.
- BravoRG remains available as a local asset but is not used as the primary Dashboard text face because its narrow proportions reduce desktop readability.
- Uppercase labels use generous tracking without sacrificing the minimum readable size.

## Surfaces

- Panels use a 1px structural border, no radius, and no decorative shadow.
- The primary metric is one framed surface with a large value and a three-column breakdown.
- Secondary data is presented as ruled rows instead of nested cards.
- Section headers carry the hierarchy; panel interiors stay dense and scannable.

## Responsive Behavior

- Dashboard content is full-width with 14px mobile gutters and a max width for larger web viewports.
- The mobile header contains the menu control, product mark, and live state in one row.
- Long names truncate inside fixed row layouts so values remain visible.

## Interaction

- The menu control exposes an accessible label and opens the existing drawer navigation.
- Loading is explicit and uses the same green signal color as the live state.
- Empty collections keep the panel structure and provide a next-state message.
