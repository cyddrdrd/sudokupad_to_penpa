# Testing 0.2.0

Checked on 2026-09-06 against SudokuPad 0.611.0 and Penpa+ 3.2.4.

## Automated checks

Run `npm test` (Node 18 or newer; no install needed). All 144 tests pass. The suite uses synthetic puzzles and Penpa's pinned, unmodified answer-check implementation. It covers mixed single- and multi-digit answers, givens, empty solution layers, all three answer-check options, source formats, short-link retrieval, safe parsing, drawing layers, and complex outlines. Version 0.2.0 adds checks for creator-named links, clickable rules, original Source addresses, usage storage, logging retries that do not interrupt conversion, and token-protected JSON/CSV views.

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
