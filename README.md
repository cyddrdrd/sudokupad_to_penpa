## Disclaimer ##

This tool is intended for puzzle setters, testers, and those who want to play SudokuPad puzzles in Penpa+.
Please respect puzzle authors and do not redistribute their puzzles without permission.

---

# SudokuPad to Penpa+

SudokuPad to Penpa+ is a small web tool for converting SudokuPad links into Penpa+ links.
It is designed for puzzle setters, testers, and those who prefer to solve puzzles in Penpa+.

Website: https://cyddrdrd.github.io/sudokupad_to_penpa/

## What it does

SudokuPad links can contain:

- the puzzle grid, clues, and rules
- an answer for solution checking

This tool decodes the link, converts the supported puzzle objects, and generates a new Penpa+ link.
When the original puzzle includes an answer, the generated link includes answer check unless "No solution check" is ticked.
When no answer is included, the generated link has no solution check.

## Supported inputs

The converter supports:

- full SudokuPad links in SCL/CTC, F-puzzles, and SCF formats
- SudokuPad short links and named puzzle paths
- TinyURL links pointing to supported puzzles
- full F-puzzles links

## Features

- Convert SudokuPad puzzles into Penpa+ links.
- Preserve static grids, regions, cages, arrows, lines, colours, text, and decorations as embedded artwork.
- Include answer check when the original puzzle contains an answer.
- Omit answer check when "No solution check" is ticked.
- Report puzzle features that cannot be fully converted.
- Provide a simple browser-based interface:
  - Convert and Open
  - Convert Only
  - Copy generated URL to clipboard

Givens and entered digits use Penpa's number tools. The grid and decorations are a background image, so they cannot be edited as individual Penpa objects. Browser zoom works normally; Penpa's grid resizing and rotation do not move the background, and surface shading can cover it.

Fog of war, interactive effects, and unsupported drawing features are reported. Partial answer checks containing unchecked cells cannot yet be reproduced; these puzzles can be converted with "No solution check" ticked.

## Browser recommendation
- Chrome or Firefox is recommended
- iPhone Safari is not recommended

Generated Penpa+ links may be extremely long. If a generated URL is too long to open directly in your browser, try using "load" in an empty Penpa+.

## How it works

The project has three main frontend files:

  - index.html for the webpage structure
  - page.js for button logic and page interaction
  - converter.js for the main SudokuPad decoding and Penpa+ conversion logic

The frontend performs the main decoding and conversion in the browser using JavaScript, LZ-String, and pako.
The "No solution check" option removes the answer-check data from the generated Penpa+ link; it does not solve the puzzle.

The main converter uses source.js to read SudokuPad formats and artwork.js to draw the puzzle. Full links are converted locally. Short links are retrieved through SudokuPad's public puzzle service; TinyURL links use the same expansion service as penpa_spoiler. This project does not log conversions.

Library sources and licences are listed in THIRD_PARTY.md. Run the regression tests with `node --test tests/behavior.cjs`.

## Changelog

See CHANGELOG.md for version history.
