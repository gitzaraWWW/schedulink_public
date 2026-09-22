  # Theme Asset Naming

Theme image assets live under `frontend/src/assets/themes`.

## Directory layout

- `shared/`
  - Assets reused across multiple themes.
- `spring/`
  - Spring-specific assets.
- `spring/particles/`
  - Small floating decorative pieces such as petals or sparkles.
- `spring/stickers/`
  - Reusable decorative objects such as mascots, benches, baskets, or bicycles.
- `spring/highlights/`
  - Date-cell highlight backgrounds for today or selected states.

## File naming rules

- Use lowercase letters only.
- Use kebab-case.
- Use English nouns only.
- Keep the theme name as the first segment for top-level theme files.
- Use a numeric suffix for variants: `-01`, `-02`, `-03`.
- Prefer `.webp` for large background-like assets.
- Prefer `.png` for transparent overlays, particles, stickers, and highlights.

## Spring top-level files

- `spring-backdrop.webp`
- `spring-top-overlay.webp`
- `spring-bottom-overlay.webp`
- `spring-corner-top-left.png`
- `spring-corner-top-right.png`
- `spring-corner-bottom-left.png`
- `spring-corner-bottom-right.png`
- `spring-empty-state.png`

## Spring particles

- `spring-petal-01.png`
- `spring-petal-02.png`
- `spring-petal-03.png`
- `spring-petal-04.png`
- `spring-petal-05.png`
- `spring-petal-06.png`
- `spring-petal-cluster-01.png`
- `spring-sparkle-01.png`
- `spring-sparkle-02.png`

## Spring stickers

- `spring-sticker-mascot-sit.png`
- `spring-sticker-mascot-picnic.png`
- `spring-sticker-picnic-basket.png`
- `spring-sticker-bicycle-flower.png`
- `spring-sticker-bench.png`
- `spring-sticker-lamp-post.png`
- `spring-sticker-signboard.png`
- `spring-sticker-flower-bed.png`

## Spring highlights

- `spring-highlight-today.png`
- `spring-highlight-selected.png`

## Shared assets

Use `shared/` only when the same asset is intentionally reused by multiple themes.

Examples:

- `shared-cloud-soft-01.png`
- `shared-sparkle-soft-01.png`
- `shared-paper-grain-01.webp`
