/* SudokuPad to Penpa+: puzzle assembly and Penpa 3.2.4 solve-link encoding. */
(function (root) {
  "use strict";

  const PENPA_BASE = "https://swaroopg92.github.io/penpa-edit/";
  const CHECK_OPTIONS = ["surface_exact", "surface", "number", "loopline_exact", "loopline",
    "ignoreloopline", "loopedge_exact", "loopedge", "ignoreborder", "wall", "square",
    "circle", "tri", "arrow", "math", "battleship", "tent", "star", "akari", "mine"];
  // Penpa's ordered wire-format substitutions. Escape literal z first.
  const COMPRESS_SUB = [["z", "zZ"], ...[
    ["qa", "9"], ["pu_q", "Q"], ["pu_a", "A"], ["grid", "G"],
    ["edit_mode", "M"], ["surface", "S"], ["line", "L"], ["lineE", "E"],
    ["wall", "W"], ["cage", "C"], ["number", "N"], ["symbol", "Y"],
    ["special", "P"], ["board", "B"], ["command_redo", "R"], ["command_undo", "U"],
    ["command_replay", "8"], ["numberS", "1"], ["freeline", "F"], ["freelineE", "2"],
    ["thermo", "T"], ["arrows", "3"], ["direction", "D"], ["squareframe", "0"],
    ["polygon", "5"], ["deletelineE", "4"], ["killercages", "6"],
    ["nobulbthermo", "7"], ["__a", "_"]
  ].map(([key, token]) => [JSON.stringify(key), "z" + token]), ["null", "zO"]];

  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function deflate(text) {
    return bytesToBase64(root.pako.deflateRaw(new TextEncoder().encode(text), {level: 9}));
  }

  function emptyLayer() {
    const layer = {};
    for (const key of ["command_redo", "command_undo", "command_replay"]) layer[key] = {__a: []};
    for (const key of ["surface", "number", "numberS", "symbol", "line", "lineE", "wall",
      "cage", "deletelineE", "freeline", "freelineE"]) layer[key] = {};
    for (const key of ["thermo", "arrows", "direction", "squareframe", "polygon",
      "killercages", "nobulbthermo"]) layer[key] = [];
    return layer;
  }

  const enabled = value => [true, 1, "1", "true"].includes(value);

  function penpaMode(puzzle) {
    const part = color => ({edit_mode: "number", surface: ["", 1], multicolor: ["", 1],
      line: ["1", color === 1 ? 2 : 3], lineE: ["1", color === 1 ? 2 : 3],
      wall: ["", color === 1 ? 2 : 3], cage: ["1", 10], number: ["1", color],
      symbol: ["circle_L", 1], special: ["thermo", ""], board: ["", ""],
      move: ["1", ""], combi: ["battleship", 3], sudoku: ["1", color === 1 ? 1 : 9]});
    // Native grid lines are redrawn after Surface fills in Penpa. Only the
    // portions covered by artwork stay in the background image.
    const gridStyle = enabled(puzzle.settings?.nogrid) ? "3" : enabled(puzzle.settings?.dashedgrid) ? "2" : "1";
    return {qa: "pu_a", grid: [gridStyle, "2", "2"], pu_q: part(1), pu_a: part(2)};
  }

  function addNativeGrid(puzzle, artwork, question, rows, cols) {
    const stride = cols + 4, pointCount = stride * (rows + 4);
    const vertex = (r, c) => pointCount + (r + 1) * stride + c + 1;
    const edgeKey = (r, c, rr, cc) => {
      const a = vertex(r, c), b = vertex(rr, cc);
      return Math.min(a, b) + "," + Math.max(a, b);
    };
    const occluded = (r, c, rr, cc) => root.SudokuPadArtwork.gridEdgeOccluded(
      artwork.gridOcclusions || [], c * 64, r * 64, cc * 64, rr * 64);
    // A mask can hide only part of an edge. Keep that whole edge in the image
    // so a native line cannot cut through its white fill or decorative text.
    if (!enabled(puzzle.settings?.nogrid)) {
      for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
        if (occluded(r, c, r, c + 1)) question.deletelineE[edgeKey(r, c, r, c + 1)] = 1;
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
        if (occluded(r, c, r + 1, c)) question.deletelineE[edgeKey(r, c, r + 1, c)] = 1;
      }
    }
    const boundaries = [
      ...(puzzle.regions || []).map(cells => ({cells})),
      ...(puzzle.cages || []).filter(cage => cage && cage.style === "box" && !cage.hidden)
    ];
    for (const boundary of boundaries) {
      const color = String(boundary.borderColor ?? boundary.outlineC ?? "#000000").toLowerCase();
      // Custom colored box borders remain in the image: Penpa's optional
      // custom-color preference must not turn them black on another device.
      if (!["#000000", "#000", "black"].includes(color)) continue;
      const cells = new Set((boundary.cells || []).filter(Array.isArray).map(([r, c]) => r + "," + c));
      const add = (r, c, rr, cc) => {
        if (Math.min(r, rr) < 0 || Math.max(r, rr) > rows ||
          Math.min(c, cc) < 0 || Math.max(c, cc) > cols || occluded(r, c, rr, cc)) return;
        // Penpa style 4 is a two-pixel black boundary, matching the converted
        // three-source-pixel region outline at the 38/64 cell scale.
        question.lineE[edgeKey(r, c, rr, cc)] = 4;
      };
      for (const cell of cells) {
        const [r, c] = cell.split(",").map(Number);
        if (!cells.has((r - 1) + "," + c)) add(r, c, r, c + 1);
        if (!cells.has(r + "," + (c + 1))) add(r, c + 1, r + 1, c + 1);
        if (!cells.has((r + 1) + "," + c)) add(r + 1, c, r + 1, c + 1);
        if (!cells.has(r + "," + (c - 1))) add(r, c, r + 1, c);
      }
    }
  }

  function metadataOf(puzzle) {
    const metadata = Object.create(null);
    for (const key of ["title", "author", "rules", "solution"]) {
      if (puzzle[key] !== undefined) metadata[key] = puzzle[key];
    }
    for (const cage of puzzle.cages || []) {
      if (!cage || (cage.cells || []).some(Array.isArray)) continue;
      const match = String(cage.value ?? "").match(/^(.+?):\s*([\s\S]+)/m);
      if (match) metadata[match[1]] = match[2];
    }
    for (const source of [puzzle.metaData, puzzle.metadata]) {
      if (source && typeof source === "object" && !Array.isArray(source)) {
        for (const [key, value] of Object.entries(source)) metadata[key] = value;
      }
    }
    return metadata;
  }

  function dimensions(puzzle) {
    if (!Array.isArray(puzzle.cells) || !puzzle.cells.length ||
      !puzzle.cells.every(row => Array.isArray(row) && row.length)) {
      throw new Error("The SudokuPad puzzle has no valid cell grid.");
    }
    const rows = puzzle.cells.length;
    const cols = Math.max(...puzzle.cells.map(row => row.length));
    if (rows > 100 || cols > 100) throw new Error("Penpa supports grids up to 100 × 100 cells.");
    if (!puzzle.cells.every(row => row.length === cols)) {
      throw new Error("Rows with different lengths cannot yet be converted.");
    }
    return {rows, cols};
  }

  function solutionCells(solution, count) {
    let values;
    if (Array.isArray(solution)) {
      values = solution.some(Array.isArray) ? solution.flat() : solution.slice();
    } else if (typeof solution === "string" || typeof solution === "number") {
      const text = String(solution).trim();
      values = text.includes(",") ? text.split(",").map(value => value.trim()) : Array.from(text);
    } else {
      throw new Error("The stored answer has an unsupported format. Tick No solution check to convert the puzzle without it.");
    }
    if (values.length !== count) {
      throw new Error("The stored answer does not match the grid size. Tick No solution check to convert without it.");
    }
    return values.map(value => {
      if (value === "?") {
        throw new Error("Penpa cannot reproduce this puzzle's partial answer check. Tick No solution check to convert without it.");
      }
      if (value === "." || value === "" || value === null) return "";
      if ((typeof value !== "string" && typeof value !== "number") ||
        !/^(?:\d+|[A-Za-z]+)$/.test(String(value))) {
        throw new Error("The stored answer contains an unsupported cell value. Tick No solution check to convert without it.");
      }
      return String(value);
    });
  }

  function headerText(value) {
    return String(value ?? "").replace(/[\r\n]/g, " ").replace(/,/g, "%2C");
  }

  function sourceText(value) {
    let source = String(value ?? "").trim();
    if (!source) return "https://sudokupad.app/";
    if (/^[a-z][a-z\d+.-]*:/i.test(source) && !/^https?:\/\//i.test(source)) {
      throw new Error("The puzzle source must be an HTTP or HTTPS link.");
    }
    if (!/^https?:\/\//i.test(source)) source = "https://sudokupad.app/" + source;
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("The puzzle source must be an HTTP or HTTPS link without login details.");
    }
    // Source is not URI-decoded by Penpa. Retain the input spelling and query,
    // encoding only characters which break its comma/newline header or HTML.
    return source.replace(/[,\u0000-\u0020<>\u007f]/g, character => encodeURIComponent(character));
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function rulesText(value) {
    const text = (Array.isArray(value) ? value.join("\n") : String(value ?? ""))
      .replace(/\r\n?/g, "\n").replace(/\\n/g, "\n");
    // SudokuPad rules are text, with Markdown links. Build the only permitted
    // markup ourselves so clue text can never supply HTML or event handlers.
    const links = /\[([^\]\r\n]{1,500})\]\((https?:\/\/[^)\r\n]{1,50000})\)/gi;
    let html = "", start = 0, match;
    while ((match = links.exec(text))) {
      html += escapeHtml(text.slice(start, match.index));
      let destination;
      try {
        const url = new URL(match[2]);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
          !/[\u0000-\u0020\u007f]/.test(match[2])) destination = url.href;
      } catch (_) { /* Keep a malformed link visible as its original text. */ }
      html += destination ? '<a href="' + escapeHtml(destination) + '">' + escapeHtml(match[1]) + '</a>' : escapeHtml(match[0]);
      start = links.lastIndex;
    }
    html += escapeHtml(text.slice(start));
    // Penpa uses %2C..%2F as its own delimiters, including inside URLs. Protect
    // literal percent escapes until after that decoding by using HTML entities.
    return html.replace(/%/g, "&#37;").replace(/\n/g, "%2D").replace(/,/g, "%2C")
      .replace(/&/g, "%2E").replace(/=/g, "%2F");
  }

  function convertPuzzle(puzzle, options = {}) {
    if (!puzzle || typeof puzzle !== "object") throw new Error("Invalid SudokuPad puzzle.");
    const {rows, cols} = dimensions(puzzle);
    const metadata = metadataOf(puzzle);
    const hasSolution = metadata.solution !== undefined && metadata.solution !== null && metadata.solution !== "";
    const includedSolution = hasSolution && !options.noSolutionCheck;
    const solution = includedSolution ? solutionCells(metadata.solution, rows * cols) : null;
    const size = 38, stride = cols + 4, pointCount = stride * (rows + 4);
    const cellId = (r, c) => (r + 2) * stride + c + 2;
    const question = emptyLayer(), colors = emptyLayer(), centers = [], answer = [[], [], [], [], [], []];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = cellId(r, c), cell = puzzle.cells[r][c];
        if (!cell || typeof cell !== "object" || Array.isArray(cell)) throw new Error("Invalid cell data in the SudokuPad puzzle.");
        centers.push(id);
        const given = cell.value;
        if (given !== undefined && given !== null && given !== "") {
          if (!["string", "number"].includes(typeof given)) throw new Error("A given has an unsupported value.");
          question.number[id] = [String(given), 1, "1"];
          if (solution && solution[r * cols + c] !== String(given)) {
            throw new Error("A given conflicts with the stored answer. Tick No solution check to convert without it.");
          }
        } else if (solution && solution[r * cols + c] !== "") {
          answer[4].push(id + "," + solution[r * cols + c]);
        }
      }
    }
    answer[4].sort();
    // Keep answer metadata out of the artwork. The Source field intentionally
    // preserves the original input link, which can itself contain puzzle data.
    const visiblePuzzle = {...puzzle, metadata: {...metadata}};
    delete visiblePuzzle.metaData;
    delete visiblePuzzle.solution;
    delete visiblePuzzle.metadata.solution;
    visiblePuzzle.cages = (puzzle.cages || []).filter(cage => cage && (cage.cells || []).some(Array.isArray));
    const clues = root.SudokuPadNativeClues.planClues(visiblePuzzle, {cellSize: size});
    const renderOptions = {cellSize: size, nativeGrid: true,
      nativeOverlayText: new Set(clues.overlayIndices), nativeUnderlayText: new Set(clues.underlayIndices)};
    let artwork = root.SudokuPadArtwork.render(visiblePuzzle, renderOptions);
    const nativeLines = root.SudokuPadNative.planLines(visiblePuzzle,
      {cellSize: size, occlusions: artwork.lineOcclusions});
    if (nativeLines.lineIndices.size) {
      artwork = root.SudokuPadArtwork.render(visiblePuzzle, {...renderOptions, nativeLineIndices: nativeLines.lineIndices});
    }
    addNativeGrid(visiblePuzzle, artwork, question, rows, cols);
    Object.assign(question.line, nativeLines.line);
    Object.assign(colors.line, nativeLines.colors);
    Object.assign(question.number, clues.question.number);
    Object.assign(question.numberS, clues.question.numberS);
    // Penpa's four point bands provide every half-cell coordinate. Align its
    // native cells with the artwork after fitting asymmetric outside clues.
    const centerX = artwork.centerX, centerY = artwork.centerY;
    const halfX = !Number.isInteger(centerX), halfY = !Number.isInteger(centerY);
    const band = halfX ? (halfY ? 0 : 2) : (halfY ? 3 : 1);
    const center = Math.floor(centerX + 1.5) + stride * Math.floor(centerY + 1.5) + band * pointCount;
    const bg = {url: "data:image/svg+xml;base64," + bytesToBase64(new TextEncoder().encode(artwork.svg)),
      x: 0, y: 0, width: artwork.width, height: artwork.height,
      foreground: false, opacity: 100, mask_white: false};
    const mode = penpaMode(puzzle);
    const andSettings = Object.fromEntries(CHECK_OPTIONS.map(name => ["sol_" + name, includedSolution && name === "number"]));
    const orSettings = Object.fromEntries(CHECK_OPTIONS.filter(name => !["ignoreloopline", "ignoreborder"].includes(name))
      .map(name => ["sol_or_" + name, false]));
    const header = ["square", cols, rows, size, 0, 1, 1, artwork.width, artwork.height,
      center, center, 0, 0, 0, 0, "Title: " + headerText(metadata.title),
      "Author: " + headerText(metadata.author), sourceText(options.sourceUrl), rulesText(metadata.rules),
      "OFF", "false", deflate(JSON.stringify(bg))].join(",");
    const deltaCenters = centers.map((id, index) => index ? id - centers[index - 1] : id);
    const lines = [header, JSON.stringify([0, 0, 0, 0]),
      JSON.stringify(mode.grid) + '~"number"~' + JSON.stringify(mode.pu_a.number),
      JSON.stringify(question), "", JSON.stringify(deltaCenters),
      // An empty selector keeps Penpa's full set of solving tools available.
      "[]",
      JSON.stringify(andSettings), '"x"', '"x"', "[3,2,4]", JSON.stringify(mode),
      '"x"', nativeLines.usesCustomColors ? "1" : "0", JSON.stringify(colors), "x", JSON.stringify(orSettings), "[]", "false"];
    let text = lines.join("\n");
    for (const [plain, short] of COMPRESS_SUB) text = text.split(plain).join(short);
    // Penpa reads Base64 literally; its loader does not URI-decode these fields.
    const url = PENPA_BASE + "#m=solve&p=" + deflate(text) +
      (includedSolution ? "&a=" + deflate(JSON.stringify(answer)) : "");
    return {url, hasSolution, includedSolution, warnings: artwork.warnings || [], rows, cols};
  }

  async function convertSudokuPadUrlDetailed(input, options = {}) {
    const decoded = await root.SudokuPadSource.decode(input, {fetch: options.fetch});
    const result = convertPuzzle(decoded.puzzle, {...options, sourceUrl: input});
    return {...result, format: decoded.format,
      warnings: [...new Set([...(decoded.warnings || []), ...result.warnings])]};
  }

  async function convertSudokuPadUrl(input, options) {
    return (await convertSudokuPadUrlDetailed(input, options)).url;
  }

  root.SudokuPadToPenpa = {convertPuzzle, metadataOf, solutionCells};
  root.convertSudokuPadUrlDetailed = convertSudokuPadUrlDetailed;
  root.convertSudokuPadUrl = convertSudokuPadUrl;
})(globalThis);
