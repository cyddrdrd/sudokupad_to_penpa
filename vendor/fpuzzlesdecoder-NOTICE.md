# F-puzzles translator

`fpuzzlesdecoder.js` is derived from [SudokuPad/sudokutools](https://github.com/SudokuPad/sudokutools/blob/f538286431c7b9b2741dba2f6160665c167d4d88/src/fpuzzlesdecoder.js), by Sven Neumann. The repository is distributed under the Mozilla Public License 2.0; the full license is in `MPL-2.0.txt`.

Local modifications accept an already decoded puzzle object, replace the unused MD5-based ID with a fixed import ID, allow fractional and negative coordinates, preserve multiline metadata, accept metadata cages without a cell list, and expose the supported feature names and browser namespace. The translator itself never fetches data when used by `source.js`.

The bundled translator contains its original LZ-string-compatible codec. The separate LZ-string and pako files retain their own licenses.
