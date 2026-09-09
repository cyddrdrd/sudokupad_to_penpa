# Testing 0.2.1

Checked on 2026-09-09 against SudokuPad 0.611.0 and Penpa+ 3.2.4.

## Automated checks

Run `npm test` (Node 18 or newer; no install needed). All 172 tests pass. The suite uses synthetic puzzles and Penpa's pinned, unmodified answer-check implementation. It covers mixed single- and multi-digit answers, givens, empty solution layers, all three answer-check options, source formats, short-link retrieval, safe parsing, drawing layers, and complex outlines. Version 0.2.0 adds checks for creator-named links, clickable rules, original Source addresses, usage storage, logging retries that do not interrupt conversion, and token-protected JSON/CSV views, numbered IDs, and request location/browser metadata.

## 0.2.1 drawing regressions

The actual Penpa+ 3.2.4 editor loads both [Wreath](https://sudokupad.app/zyjs2yh4bp) [versions](https://sudokupad.app/g58mmwifkd), retaining all nine octagons, twenty coloured lines, and the second version's twelve labels. Their correct answers pass, changed digits fail, and the answer-check opt-out works.

[Japanese Nurikabe (2)](https://sudokupad.app/wtddstx0cx?setting-conflictchecker=0) retains its 130 outside clues. Its canvas changes from 1102 × 1083 to 874 × 874, with normal right and bottom margins. Native cell centres match the artwork, and a puzzle without a stored answer remains unchecked.

Actual Surface drags across adjacent cells retain thin grid lines and thick region borders. Native given and entered digits remain visible, and a white overlay still hides the grid beneath it. Automated checks also cover asymmetric clues on each side, all grid dimension parities, dashed/hidden grids, safe named cage styles, and masked edges.

All ten browser cases pass, including repeat checks of Krop Circles, Circles and Dots, Factory Farming, Area 51, and Oyster. These retain their drawing layers, rotated emoji, and hidden-grid settings.

Decorations remain embedded artwork. Surface fills can still cover decorations and grid portions beneath decorative masks; those portions are deliberately kept in the image so native lines do not cut through the artwork.

## 0.2.0 regression examples

These four puzzles passed in the actual Penpa+ 3.2.4 editor. Artwork and solving tools loaded, Source matched the original input, correct answers passed, changed digits failed, and "No solution check" removed checking.

| Puzzle | Coverage |
| --- | --- |
| [Japanese Sum Whisper Loop, yttrio](https://sudokupad.app/yttrio/japanese-sum-whisper-loop) | Creator-named path and outside clues |
| [Exclusive Internal Skyscraper Yin Yang, yttrio](https://sudokupad.app/yttrio/exclusive-internal-skyscraper-yin-yang) | Creator-named path and shaded clues |
| [Different Sum Whisper Loop, yttrio](https://sudokupad.app/yttrio/different-sum-whisper-loop) | Creator-named path and line artwork |
| [Memories of a Far Off Land](https://sudokupad.app/k7qc98e00u?setting-nogrid.) | All five emoji hyperlinks retain their exact destinations; Source retains the full query |

The short-link services were checked against live public responses. The repeatable editor checks use saved copies of those responses. The Worker passes Cloudflare's deployment build validation and a real local Worker/D1 integration run: success, failure, and blank-input events persisted, a retry created no duplicate, and CORS and validation rejected invalid requests.

Live GitHub Pages conversions were also checked against the production D1 database: successful conversions with checking on and off, an invalid link, and a blank input all persisted with the expected fields. Both deployed log-viewing routes returned 401 without a viewing token.

The metadata migration was verified against the backed-up production data and an isolated Wrangler D1 database. Existing values and IDs survived unchanged; new IDs are not reused, retries remain deduplicated, repeated migration application is a no-op, and an injected failure rolls back the entire migration.

After deployment, live successful and failed conversions both received numbered IDs and populated country, region, city, colo, and User-Agent fields. The five migrated historical records were compared with the private backup and matched exactly; ADMIN_TOKEN remained configured.

## Real puzzles

The following puzzles were decoded, opened in the actual Penpa editor, and checked for loaded artwork and an empty initial answer layer. Every stored answer passed Penpa's checker; changing a digit failed. Converting with "No solution check" omitted the check in every case. Puzzles without stored answers remained unchecked.

| Puzzle | Coverage |
| --- | --- |
| [Classic Sudoku](https://sudokupad.app/94Qq6qGjh2) | Given digits; no stored answer |
| [SudokuPad arrow example](https://sudokupad.app/sudoku/DGT6HQ46FN) | Elongated two-digit bulbs and arrows |
| [SudokuPad cage example](https://sudokupad.app/sudoku/BLLGjtrb4P) | Cages, coloured cells, inequalities, outside clues |
| [Circles and Dots, Juggler](https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000GMA) | Circle shading, black and white dots |
| [Krop Circles, Marty Sears](https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000GID) | Plant drawings, a sickle, a diamond, masks, fractional positions |
| [Factory Farming, Marty Sears](https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000KKM) | Rotated egg emoji and zero-width text objects |
| [Oyster, Juggler](https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000RM6) | Hidden standard grid, custom region outlines, layered strands, unused answer positions |
| [Area 51, Juggler](https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000R4A) | Hidden grid, 141 lines, transparent textures and a fence clue |

Third-party puzzle payloads are kept outside this repository. The drawings are tested as static artwork; these checks do not establish support for every SudokuPad feature. Penpa grid transforms, surface shading, fog, interactive effects, and partial answer checks have the limitations described in README.md.
