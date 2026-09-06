/* Decode the published SudokuPad and F-puzzles URL formats without executing puzzle text. */
(function (root) {
  "use strict";

  const MAX_INPUT = 300000;
  const MAX_TEXT = 3000000;
  const FORMATS = /^(fpuzzles|fpuz|scl|ctc|scf)([\s\S]*)$/;
  const HOSTS = new Set(["sudokupad.app", "www.sudokupad.app", "beta.sudokupad.app",
    "alpha.sudokupad.app", "app.crackingthecryptic.com", "test.crackingthecryptic.com",
    "sudokupad.svencodes.com"]);
  const PROP_NAMES = {c: "color", ca: "cages", ct: "center", c1: "borderColor",
    c2: "backgroundColor", ce: "cells", cs: "cellSize", a: "arrows", o: "overlays",
    u: "underlays", w: "width", h: "height", v: "value", vd: "videos", l: "lines",
    r: "rounded", re: "regions", fs: "fontSize", th: "thickness", hl: "headLength",
    wp: "wayPoints", t: "title", te: "text", d: "duration", d2: "d"};
  const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
  const record = value => value && typeof value === "object" && !Array.isArray(value);

  function checkTree(value, depth = 0, count = {n: 0}) {
    if (++count.n > 150000 || depth > 80) throw new Error("This puzzle is too large or deeply nested.");
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (BAD_KEYS.has(key)) throw new Error("The puzzle contains an invalid property name.");
        checkTree(value[key], depth + 1, count);
      }
    }
    return value;
  }

  // SudokuPad's compact syntax resembles JSON but leaves property names,
  // booleans, colours, and empty objects abbreviated. This parser treats quoted
  // text separately, so rules containing punctuation cannot become syntax.
  function parseCompact(text) {
    let i = 0;
    let count = 0;
    const bad = () => { throw new Error("The SudokuPad puzzle data is not valid."); };
    const space = () => { while (/\s/.test(text[i] || "") && i < text.length) i++; };
    function string() {
      const quote = text[i++];
      let value = "";
      while (i < text.length) {
        const ch = text[i++];
        if (ch === quote) return value;
        if (ch !== "\\") { value += ch; continue; }
        const escaped = text[i++];
        const escapes = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "/": "/", "'": "'", '"': '"'};
        if (escaped === "u") {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-f]{4}$/i.test(hex)) bad();
          value += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else if (own(escapes, escaped)) value += escapes[escaped];
        else bad();
      }
      bad();
    }
    function value(depth) {
      if (++count > 150000 || depth > 80) throw new Error("This puzzle is too large or deeply nested.");
      space();
      const ch = text[i];
      if (ch === "'" || ch === '"') return string();
      if (ch === "{") {
        i++; space();
        const result = {};
        if (text[i] === "}") { i++; return result; }
        for (;;) {
          space();
          let key;
          if (text[i] === "'" || text[i] === '"') key = string();
          else {
            const match = /^[A-Za-z0-9_]+/.exec(text.slice(i));
            if (!match) bad();
            key = match[0]; i += key.length;
          }
          if (BAD_KEYS.has(key) || own(result, key)) bad();
          space(); if (text[i++] !== ":") bad();
          result[key] = value(depth + 1);
          space();
          if (text[i] === "}") { i++; return result; }
          if (text[i++] !== ",") bad();
        }
      }
      if (ch === "[") {
        i++;
        const result = [];
        for (;;) {
          space();
          // A compact [] is a one-element row whose sole empty object was
          // removed. A normal JSON [] was already handled by JSON.parse.
          if (text[i] === "]") { result.push({}); i++; return result; }
          if (text[i] === ",") { result.push({}); i++; continue; }
          result.push(value(depth + 1));
          space();
          if (text[i] === "]") { i++; return result; }
          if (text[i++] !== ",") bad();
        }
      }
      const match = /^[^\s,\]}]+/.exec(text.slice(i));
      if (!match) bad();
      const token = match[0]; i += token.length;
      if (token === "t" || token === "true") return true;
      if (token === "f" || token === "false") return false;
      if (token === "null") return null;
      if (token === "#0") return "#000000";
      if (token === "#F") return "#FFFFFF";
      if (/^[0-9a-f]{6}$/i.test(token)) return "#" + token;
      if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) {
        const number = Number(token);
        if (Number.isFinite(number)) return number;
      }
      bad();
    }
    const parsed = value(0);
    space(); if (i !== text.length) bad();
    function expand(node) {
      if (Array.isArray(node)) return node.map(expand);
      if (!record(node)) return node;
      const result = {};
      for (const [key, val] of Object.entries(node)) {
        const mapped = own(PROP_NAMES, key) ? PROP_NAMES[key] : key;
        if (own(result, mapped)) throw new Error("The puzzle contains conflicting property names.");
        result[mapped] = expand(val);
      }
      return result;
    }
    return checkTree(expand(parsed));
  }

  function parseData(text) {
    if (typeof text !== "string" || text.length > MAX_TEXT) throw new Error("The puzzle data is too large.");
    try { return checkTree(JSON.parse(text)); }
    catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      return parseCompact(text);
    }
  }

  function decodePercent(text) {
    try { return decodeURIComponent(text); }
    catch (_) { throw new Error("The link contains invalid percent-encoding."); }
  }

  function decompress(payload) {
    const codec = root.LZString || (root.SudokuPadFPuzzles && {decompressFromBase64: root.SudokuPadFPuzzles.decompressPuzzle});
    if (!codec) throw new Error("The compression library did not load. Refresh the page and try again.");
    if (/^\s*[\[{]/.test(payload)) return payload;
    const normalized = payload.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) throw new Error("The puzzle payload is not valid compressed data.");
    const result = codec.decompressFromBase64(normalized);
    if (typeof result !== "string" || !result.length || result.length > MAX_TEXT) {
      throw new Error("The puzzle data could not be decompressed. Check that the whole link was copied.");
    }
    return result;
  }

  function extractMetadata(puzzle) {
    const metadata = {};
    for (const cage of puzzle.cages || []) {
      if (!record(cage) || (cage.cells || []).length) continue;
      const match = /^(.+?):\s*([\s\S]+)/m.exec(String(cage.value || ""));
      if (!match || BAD_KEYS.has(match[1])) continue;
      const [, name, val] = match;
      if (name === "rules") {
        if (!Array.isArray(metadata.rules)) metadata.rules = [];
        metadata.rules.push(val);
      } else metadata[name] = val;
    }
    for (const input of [puzzle.metaData, puzzle.metadata]) {
      if (record(input)) for (const [key, val] of Object.entries(input)) metadata[key] = val;
    }
    for (const key of ["title", "author", "rules", "solution"]) {
      if (!own(metadata, key) && own(puzzle, key)) metadata[key] = puzzle[key];
    }
    if (typeof metadata.solution === "number") metadata.solution = String(metadata.solution);
    return metadata;
  }

  function rejectInteractive(puzzle) {
    const fog = ["foglight", "fogofwar", "foglink"].some(key => own(puzzle, key)) ||
      (puzzle.negative || []).includes("foglight") ||
      (puzzle.cage || []).some(cage => /^(FOW|FOGLIGHT)$/.test(cage.value));
    if (fog) throw new Error("Fog of war puzzles cannot be converted faithfully to Penpa+ yet.");
    const fields = ["triggereffect", "puzzleevents", "events", "triggers", "userplugins", "puzzlepack"];
    if (fields.some(key => own(puzzle, key) && puzzle[key] && (!Array.isArray(puzzle[key]) || puzzle[key].length))) {
      throw new Error("This puzzle uses interactive features that Penpa+ cannot reproduce.");
    }
  }

  function normalizeNative(puzzle) {
    if (!record(puzzle) || !Array.isArray(puzzle.cells) || !puzzle.cells.length) {
      throw new Error("The link does not contain a supported SudokuPad puzzle.");
    }
    rejectInteractive(puzzle);
    puzzle.metadata = extractMetadata(puzzle);
    const ruleDescriptions = {
      antiknight: "Cells separated by a knight's move must contain different digits.",
      antiking: "Cells separated by a king's move must contain different digits.",
      nonconsecutive: "Orthogonally adjacent cells must not contain consecutive digits.",
      disjointgroups: "Cells in corresponding positions within the marked regions must contain different digits.",
      "diagonal+": "Digits cannot repeat on the marked bottom-left to top-right diagonal.",
      "diagonal-": "Digits cannot repeat on the marked top-left to bottom-right diagonal.",
      antidifference: "All orthogonally adjacent pairs differing by 1 are marked.",
      antiratio: "All orthogonally adjacent pairs with ratio 2 are marked.",
      antixv: "All orthogonally adjacent pairs summing to 5 or 10 are marked."
    };
    const globalRules = new Set(puzzle.global || []);
    for (const key of Object.keys(ruleDescriptions)) if (puzzle.metadata[key] === true) globalRules.add(key);
    const unknownRules = [...globalRules].filter(key => !own(ruleDescriptions, key));
    if (unknownRules.length) throw new Error("Unsupported global puzzle constraints: " + unknownRules.join(", ") + ".");
    if (globalRules.size) {
      const rules = Array.isArray(puzzle.metadata.rules) ? puzzle.metadata.rules.slice() :
        puzzle.metadata.rules ? [String(puzzle.metadata.rules)] : [];
      const combined = rules.join("\n");
      const additions = [...globalRules].map(key => ruleDescriptions[key]).filter(text => !combined.includes(text));
      if (additions.length) rules.push("Global constraints: " + additions.join(" "));
      puzzle.metadata.rules = rules;
      delete puzzle.global;
    }
    if (puzzle.regions) puzzle.regions = puzzle.regions
      .filter(Array.isArray).map(region => region.filter(Array.isArray)).filter(region => region.length);
    return puzzle;
  }

  function nonempty(value) {
    return value !== undefined && value !== null && value !== false && value !== "" &&
      (!Array.isArray(value) || value.length > 0) && (!record(value) || Object.keys(value).length > 0);
  }

  function fromFPuzzles(fpuzzle) {
    if (!record(fpuzzle) || !Array.isArray(fpuzzle.grid) || !fpuzzle.grid.length ||
        fpuzzle.grid.some(row => !Array.isArray(row) || !row.length || row.some(cell => !record(cell)))) {
      throw new Error("The F-puzzles link does not contain a valid grid.");
    }
    rejectInteractive(fpuzzle);
    const decoder = root.SudokuPadFPuzzles;
    if (!decoder) throw new Error("The F-puzzles library did not load. Refresh the page and try again.");
    const allowed = new Set([...decoder.supportedFeatures, "id", "version", "metadata", "metaData",
      "solution", "negative", "nonconsecutive", "disjointgroups", "rules", "source"]);
    const unknown = Object.keys(fpuzzle).filter(key => !allowed.has(key) && nonempty(fpuzzle[key]));
    if (unknown.length) throw new Error("Unsupported F-puzzles features: " + unknown.join(", ") + ".");
    for (const row of fpuzzle.grid) for (const cell of row) {
      if (Array.isArray(cell.cArray) && cell.cArray.length > 1) {
        throw new Error("Cells with multiple given colours are not supported yet.");
      }
    }
    // Keep the saved solution outside the older translator, which otherwise
    // joins multi-digit entries together and loses cell boundaries.
    const input = JSON.parse(JSON.stringify(fpuzzle));
    delete input.solution;
    let puzzle;
    try { puzzle = decoder.parseFPuzzle(input); }
    catch (err) { throw new Error("This F-puzzles drawing could not be converted: " + err.message); }
    const metadata = extractMetadata(puzzle);
    Object.assign(metadata, record(fpuzzle.metaData) ? fpuzzle.metaData : {}, record(fpuzzle.metadata) ? fpuzzle.metadata : {});
    if (own(fpuzzle, "solution") && !own(metadata, "solution")) {
      let solution = fpuzzle.solution;
      if (typeof solution === "string" && solution.includes(",")) solution = solution.split(",").map(s => s.trim());
      if (typeof solution === "number") solution = String(solution);
      const joined = Array.isArray(solution) ? solution.flat().map(String).join("") : solution;
      // F-puzzles exports empty, all-dot, and all-zero solution placeholders;
      // SudokuPad explicitly treats these as having no stored answer.
      if (typeof joined !== "string" || !/^([.]*|0*)$/.test(joined)) metadata.solution = solution;
    }
    if (!own(metadata, "solution")) {
      const allValues = fpuzzle.grid.flat().map(cell => cell.value);
      if (allValues.every(val => /^\d$/.test(String(val)))) metadata.solution = allValues.map(String).join("");
    }
    puzzle.metadata = metadata;
    puzzle.global = [];
    for (const key of ["antiknight", "antiking", "nonconsecutive", "disjointgroups", "diagonal+", "diagonal-"]) {
      if (fpuzzle[key]) { metadata[key] = true; puzzle.global.push(key); }
    }
    for (const rule of fpuzzle.negative || []) {
      if (!["ratio", "difference", "xv"].includes(rule)) throw new Error("Unsupported negative constraint: " + rule + ".");
      puzzle.global.push("anti" + rule);
    }
    return normalizeNative(puzzle);
  }

  function fromSCF(data) {
    const star = data.indexOf("*");
    const encoded = star < 0 ? data : data.slice(0, star);
    let givens = "", consumed = 0;
    for (const ch of encoded) {
      if (!/^[0-9A-Za-z]$/.test(ch)) throw new Error("The SCF puzzle contains an invalid character.");
      const n = ch.charCodeAt(0) - (ch > "Z" ? 61 : ch > "9" ? 55 : 48);
      givens += String(n % 10) + "0".repeat(Math.floor(n / 10));
      consumed++;
      if (givens.length >= 81) break;
    }
    if (givens.length < 81) throw new Error("The SCF puzzle does not contain a full 9×9 grid.");
    let constraints = star < 0 ? encoded.slice(consumed) : data.slice(star + 1);
    if (star >= 0 && consumed < encoded.length) throw new Error("The SCF grid contains extra data.");
    const cells = Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => {
      const value = givens[r * 9 + c]; return value === "0" ? {} : {value};
    }));
    const regions = Array.from({length: 9}, (_, box) => Array.from({length: 9}, (_, cell) =>
      [Math.floor(box / 3) * 3 + Math.floor(cell / 3), (box % 3) * 3 + cell % 3]));
    const puzzle = {cells, regions, cellSize: 50, metadata: {title: "Classic Sudoku", author: "SCF import", rules: ["Normal sudoku rules apply."]}};
    while (constraints.length) {
      const flag = constraints[0]; constraints = constraints.slice(1);
      if (flag === "*") continue;
      if (flag === "x") {
        puzzle.lines = [...(puzzle.lines || []),
          {color: "#34BBE6", thickness: 2, wayPoints: [[0, 0], [9, 9]]},
          {color: "#34BBE6", thickness: 2, wayPoints: [[0, 9], [9, 0]]}];
        puzzle.metadata.rules.push("Digits cannot repeat along the two main diagonals.");
        puzzle.metadata.title = "X-Sudoku";
      } else if (flag === "w") {
        puzzle.underlays = [[2.5, 2.5], [2.5, 6.5], [6.5, 2.5], [6.5, 6.5]].map(center =>
          ({center, width: 3, height: 3, backgroundColor: "#CFCFCF"}));
        puzzle.metadata.rules.push("Each shaded 3×3 region also contains the digits 1 to 9.");
        puzzle.metadata.title = puzzle.lines ? "X4Q-Sudoku" : "Windoku";
      } else if (flag === "t" || flag === "a") {
        let value = "", at = 0;
        while (at < constraints.length) {
          if (constraints[at] !== "*") { value += constraints[at++]; continue; }
          if (constraints[at + 1] === "*") { value += "*"; at += 2; continue; }
          at++; break;
        }
        constraints = constraints.slice(at);
        puzzle.metadata[flag === "t" ? "title" : "author"] = value;
      } else throw new Error("Unsupported SCF constraint: " + flag + ".");
    }
    // SCF does not store a solution. Do not run the SudokuPad loader's optional solver.
    return puzzle;
  }

  async function readURL(url, fetcher) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(url, {signal: controller.signal, credentials: "omit"});
      if (!response.ok) throw new Error("The puzzle service returned HTTP " + response.status + ".");
      const text = await response.text();
      if (text.length > MAX_TEXT) throw new Error("The downloaded puzzle is too large.");
      return text.trim();
    } finally { clearTimeout(timer); }
  }

  function rawQuery(search, name) {
    for (const part of search.replace(/^\?/, "").split("&")) {
      const at = part.indexOf("=");
      if (at >= 0 && decodePercent(part.slice(0, at)) === name) return decodePercent(part.slice(at + 1));
    }
    return null;
  }

  async function decode(input, options = {}) {
    if (typeof input !== "string" || !input.trim()) throw new Error("Please paste a SudokuPad link.");
    if (input.length > MAX_INPUT) throw new Error("This link is too long.");
    const fetcher = options.fetch || root.fetch && root.fetch.bind(root);
    let data = input.trim(), format = "", fromNetwork = false;
    const urlSettings = {};
    const result = (puzzle, format) => {
      if (Object.keys(urlSettings).length) puzzle.settings = Object.assign({}, record(puzzle.settings) ? puzzle.settings : {}, urlSettings);
      return {puzzle, format, warnings: []};
    };
    const visited = new Set();
    for (let attempt = 0; attempt < 6; attempt++) {
      if (visited.has(data)) throw new Error("The shortened link redirects in a loop.");
      visited.add(data);
      if (/^https?:\/\//i.test(data)) {
        const url = new URL(data);
        if (url.username || url.password) throw new Error("Links containing a username or password are not supported.");
        const host = url.hostname.toLowerCase();
        if (["tinyurl.com", "www.tinyurl.com"].includes(host)) {
          if (!fetcher) throw new Error("An internet connection is needed to expand this shortened link.");
          const answer = JSON.parse(await readURL("https://tinyurl-expand.cyddrdrd.workers.dev/?url=" + encodeURIComponent(url.href), fetcher));
          if (!answer.success || typeof answer.longurl !== "string" || !/^https?:\/\//i.test(answer.longurl)) throw new Error("The shortened link could not be expanded.");
          data = answer.longurl; fromNetwork = true; continue;
        }
        if (["f-puzzles.com", "www.f-puzzles.com"].includes(host)) {
          const payload = rawQuery(url.search, "load");
          if (!payload) throw new Error("The F-puzzles link is missing its puzzle data.");
          data = "fpuz" + payload;
        } else {
          if (!HOSTS.has(host)) throw new Error("Please use a SudokuPad, F-puzzles, or TinyURL link.");
          for (const [key, value] of url.searchParams) {
            if (!/^setting-[a-z][a-z0-9_-]*$/i.test(key)) continue;
            const name = key.slice(8);
            if (BAD_KEYS.has(name)) continue;
            urlSettings[name] = value === "1" || value === "true" ? true : value === "0" || value === "false" ? false : value;
          }
          const query = rawQuery(url.search, "puzzleid");
          data = query === null ? decodePercent(url.pathname.replace(/^\/(?:sudoku\/|puzzle\/)?/, "")) : query;
          if (!data) throw new Error("The link is missing its puzzle ID.");
        }
      }
      if (data.startsWith("{")) {
        if (!fromNetwork) throw new Error("Please paste a puzzle link rather than raw JSON.");
        const puzzle = parseData(data);
        return result(normalizeNative(puzzle), "scl");
      }
      if (/^pack/.test(data)) throw new Error("Puzzle packs contain several puzzles. Open one puzzle and convert its own link.");
      const match = FORMATS.exec(data);
      if (match) {
        format = match[1] === "ctc" ? "scl" : match[1] === "fpuzzles" ? "fpuz" : match[1];
        const payload = decodePercent(match[2]);
        let puzzle;
        if (format === "scf") {
          try { puzzle = fromSCF(payload); }
          catch (rawError) {
            try { puzzle = fromSCF(decompress(payload)); }
            catch (_) { throw rawError; }
          }
        } else puzzle = format === "fpuz" ? fromFPuzzles(parseData(decompress(payload))) : normalizeNative(parseData(decompress(payload)));
        return result(puzzle, format);
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9_./-]{0,499}$/.test(data) || data.split("/").some(part => part === ".." || part === ".")) {
        throw new Error("The link does not contain a valid SudokuPad puzzle ID.");
      }
      if (!fetcher) throw new Error("An internet connection is needed to load this shortened SudokuPad link.");
      let lastError;
      const encoded = encodeURIComponent(data);
      for (const endpoint of ["https://sudokupad.svencodes.com/ctclegacy/" + encoded,
        "https://firebasestorage.googleapis.com/v0/b/sudoku-sandbox.appspot.com/o/" + encoded + "?alt=media"]) {
        try { data = await readURL(endpoint, fetcher); lastError = null; break; }
        catch (err) { lastError = err; }
      }
      if (lastError) throw new Error("The shortened SudokuPad link could not be loaded. " + lastError.message);
      fromNetwork = true;
    }
    throw new Error("The shortened link contains too many redirects.");
  }

  root.SudokuPadSource = {decode, parseData, extractMetadata};
  if (typeof module !== "undefined" && module.exports) module.exports = root.SudokuPadSource;
})(typeof globalThis !== "undefined" ? globalThis : window);
