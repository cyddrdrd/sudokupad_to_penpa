# Changelog

All notable changes to this project are documented here.

## [0.2.3] - 2026-09-09

- Keep octagons, grid borders, and all clue artwork above Surface colours, with solving marks above the artwork.
- Allow shading and number entry throughout the outside clue area.
- Keep artwork aligned when resizing the grid.
- Open converted puzzles in the project's Penpa+ viewer.

---

## [0.2.2] - 2026-09-09

- Keep supported coloured lines and outer grid borders visible above Surface colours.
- Keep plain in-cell and corner clues visible above Surface colours, including Japanese Nurikabe clues.
- Fix cell borders incorrectly hidden by blank notes and nearby text.

---

## [0.2.1] - 2026-09-09

- Support puzzle data with text labels between drawing objects, including both Wreath links.
- Keep standard grid lines and region borders visible when using Penpa's Surface tool.
- Remove unnecessary opposite-side margins around puzzles with outside clues.

---

## [0.2.0] - 2026-09-06

- Add usage logging with numbered IDs, location/browser details, and token-protected JSON and CSV views.
- Support creator-named SudokuPad links, including yttrio's puzzles.
- Preserve clickable links in puzzle rules.
- Use the original input link as the Penpa source.

---

## [0.1.0] - 2026-09-06

- Convert full and shortened SudokuPad puzzle links into Penpa+ links.
- Preserve grids, clues, colours, text, and decorations as embedded artwork.
- Add Penpa+ answer check when the original puzzle includes an answer.
- Omit answer check with the "No solution check" option.
- Open converted puzzles or copy the generated URL.
