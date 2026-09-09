# Third-party code

- **LZ-String 1.5.0**, by Pieroxy, MIT. Source: https://github.com/pieroxy/lz-string/tree/1.5.0. Licence: vendor/LZ-STRING-LICENSE.txt.
- **pako 2.1.0**, by Vitaly Puzrin and Andrei Tuputcyn, MIT/Zlib. Source: https://github.com/nodeca/pako/tree/2.1.0. Licence: vendor/PAKO-LICENSE.txt.
- **SudokuPad F-puzzles translator**, by Sven Neumann, from SudokuPad/sudokutools commit `f538286431c7b9b2741dba2f6160665c167d4d88`, MPL-2.0. Source, modifications, and licence are documented in vendor/fpuzzlesdecoder-NOTICE.md and vendor/MPL-2.0.txt. The modified source is distributed in vendor/fpuzzlesdecoder.js.
- **Penpa+ 3.2.4 hosted viewer**, by Opt-Pan and Swaroop Guggilam, MIT. Pinned to commit `34e3fe97804e518288870b70d919e7e76ee18b4d`; source and changes: [penpa/NOTICE.md](penpa/NOTICE.md). Original and dependency licences are included in that directory.
- **Penpa+ 3.2.4 test reference**, by Opt-Pan and Swaroop Guggilam, MIT. Extracted from upstream commit `34e3fe97804e518288870b70d919e7e76ee18b4d` for independent regression checks. Source: https://github.com/swaroopg92/penpa-edit. Licence: tests/reference/PENPA-LICENSE.txt.

The converter's Penpa serialization follows the publicly documented upstream format. The artwork renderer is an independent implementation; it does not bundle SudokuPad's player.
