# Converter tests

Run from the project directory with Node.js 18 or later:

```sh
node --test tests/behavior.cjs
```

The tests use synthetic puzzles and run without a network connection or additional package installation. Short-link services are represented by explicit mock responses.

`harness.cjs` loads the production source decoder, artwork renderer and converter. It inflates the generated Penpa URL and checks the native answer data against Penpa's own `make_solution()` implementation. URL fields are read as literal base64, matching Penpa's loader; the harness does not hide output-encoding bugs through automatic URL decoding.

Coverage includes:

- Both checkbox states, sources without answers, and empty answer placeholders.
- Native answer checking with mixed single-digit and multi-digit values, given clues, zeroes, letters and unused cells.
- Empty solver answer layers, preserved metadata, and removal of solution metadata from artwork.
- Embedded SCL/CTC, F-puzzles and SCF formats, compact syntax, URL aliases, shortened links and fallback responses.
- Static artwork layers, transparency, rotation, emoji, hidden cages, custom grids and cage holes.
- Rejection of malformed data, unsupported interactive features and unsafe drawing attributes.

## Independent Penpa reference

`reference/penpa-reference.js` contains selected, unmodified methods from Penpa+ 3.2.4 at commit `34e3fe97804e518288870b70d919e7e76ee18b4d`. The upstream source is recorded in the file, and its MIT license is preserved in `reference/PENPA-LICENSE.txt`.

The reference code is used only by tests. It is not loaded by the webpage.

Browser visual comparisons with real author puzzles are performed separately. Those puzzle payloads and solutions are private test references and are not included in this repository.
