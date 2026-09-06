# Testing 0.1.0

Checked on 2026-09-06 against SudokuPad 0.611.0 and Penpa+ 3.2.4.

## Automated checks

Run `npm test` (Node 18 or newer; no install needed). The suite uses synthetic puzzles and Penpa's pinned, unmodified answer-check implementation. It covers mixed single- and multi-digit answers, givens, empty solution layers, all three answer-check options, source formats, short-link retrieval, safe parsing, drawing layers, and complex outlines.

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
