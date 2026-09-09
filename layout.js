/* Real Penpa margin cells for clues and drawings outside the solving grid. */
(function (root) {
  'use strict';

  const dictionaries = new Set(['surface', 'number', 'numberS', 'symbol', 'line', 'lineE',
    'wall', 'cage', 'deletelineE', 'freeline', 'freelineE']);
  const paths = new Set(['thermo', 'arrows', 'direction', 'squareframe', 'polygon',
    'killercages', 'nobulbthermo']);
  const clone = value => JSON.parse(JSON.stringify(value));

  function create(puzzle, options = {}) {
    const sourceRows = puzzle.cells?.length, sourceCols = puzzle.cells?.[0]?.length;
    if (!Number.isInteger(sourceRows) || !Number.isInteger(sourceCols) ||
      sourceRows < 1 || sourceCols < 1 || !puzzle.cells.every(row => Array.isArray(row) && row.length === sourceCols)) {
      throw new Error('The SudokuPad puzzle has no valid rectangular cell grid.');
    }
    let minR = 0, minC = 0, maxR = sourceRows, maxC = sourceCols;
    const include = (r, c) => {
      if (!Number.isFinite(r) || !Number.isFinite(c)) return;
      minR = Math.min(minR, r); minC = Math.min(minC, c);
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    };
    const visible = part => part && typeof part === 'object' &&
      !part.hidden && Number(part.opacity ?? 1) !== 0;
    for (const part of [...(puzzle.underlays || []), ...(puzzle.overlays || [])]) {
      if (!visible(part) || !Array.isArray(part.center)) continue;
      const [r, c] = part.center.map(Number);
      // A text baseline is still in the cell containing its clue. Shapes may
      // cover several cells, all of which need real interaction points.
      include(r, c);
      const width = Math.max(0, Number(part.width ?? 0)), height = Math.max(0, Number(part.height ?? 0));
      const angle = Number(part.angle ?? 0) * Math.PI / 180;
      const rx = (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) / 2;
      const ry = (Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))) / 2;
      include(r - ry, c - rx); include(r + ry, c + rx);
    }
    for (const part of [...(puzzle.lines || []), ...(puzzle.arrows || [])]) {
      if (!visible(part)) continue;
      for (const point of part.wayPoints || []) if (Array.isArray(point)) include(Number(point[0]), Number(point[1]));
    }
    for (const part of puzzle.cages || []) {
      if (!visible(part)) continue;
      for (const point of part.cells || []) if (Array.isArray(point)) {
        const [r, c] = point.map(Number); include(r, c); include(r + 1, c + 1);
      }
    }
    // The renderer can supply bounds for raw paths or other objects without
    // anchors. These reserve interaction cells only; they never enlarge the
    // artwork canvas or mirror its asymmetric margins.
    if (options.bounds) {
      const b = options.bounds;
      include(Number(b.top) / 64, Number(b.left) / 64);
      include(Number(b.bottom) / 64, Number(b.right) / 64);
    }
    const top = Math.max(0, Math.ceil(-minR)), bottom = Math.max(0, Math.ceil(maxR - sourceRows));
    const left = Math.max(0, Math.ceil(-minC)), right = Math.max(0, Math.ceil(maxC - sourceCols));
    const rows = sourceRows + top + bottom, cols = sourceCols + left + right;
    if (rows > 100 || cols > 100) {
      throw new Error('The puzzle and its outside clues exceed Penpa’s 100 × 100 cell limit.');
    }
    const stride = cols + 4, pointCount = stride * (rows + 4);
    const oldStride = sourceCols + 4, oldCount = oldStride * (sourceRows + 4);
    const cellId = (r, c) => (r + top + 2) * stride + c + left + 2;

    function pointId(value) {
      // -1 is used as a path sentinel. E is Penpa's overwrite-position alias.
      if (Number(value) < 0) return value;
      const match = String(value).match(/^(\d+)(E?)$/);
      if (!match) throw new Error('Invalid native Penpa point index.');
      const original = Number(match[1]);
      if (original >= oldCount * 12) throw new Error('Native Penpa point index is outside the original grid.');
      let band, cell, subpoint = 0, pointsPerCell = 1;
      if (original < oldCount * 4) {
        band = Math.floor(original / oldCount); cell = original % oldCount;
      } else {
        band = original < oldCount * 8 ? 4 : 8;
        pointsPerCell = 4;
        cell = Math.floor((original - band * oldCount) / 4);
        subpoint = (original - band * oldCount) % 4;
      }
      const movedCell = (Math.floor(cell / oldStride) + top) * stride + cell % oldStride + left;
      const result = band * pointCount + pointsPerCell * movedCell + subpoint;
      return match[2] ? result + match[2] : typeof value === 'string' ? String(result) : result;
    }

    function centerId(x, y) {
      x += left; y += top;
      if (![x, y].every(value => Number.isFinite(value) && Number.isInteger(value * 2))) {
        throw new Error('Penpa canvas centres must align to a half-cell point.');
      }
      const halfX = !Number.isInteger(x), halfY = !Number.isInteger(y);
      const band = halfX ? (halfY ? 0 : 2) : (halfY ? 3 : 1);
      return Math.floor(x + 1.5) + stride * Math.floor(y + 1.5) + band * pointCount;
    }

    const pointKey = key => String(key).split(',').map(pointId).join(',');
    const movePath = value => Array.isArray(value) ? value.map(movePath) :
      typeof value === 'number' || /^-?\d+E?$/.test(String(value)) ? pointId(value) : clone(value);
    function remapLayer(layer) {
      return Object.fromEntries(Object.entries(layer).map(([name, value]) => [name,
        dictionaries.has(name) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [pointKey(key), clone(entry)])) :
          paths.has(name) ? movePath(value) : clone(value)]));
    }
    function remapAnswer(answer) {
      return answer.map((entries, channel) => entries.map(entry => {
        if (Array.isArray(entry)) return [pointId(entry[0]), ...clone(entry.slice(1))];
        const parts = String(entry).split(',');
        const count = [1, 2, 3].includes(channel) ? Math.min(2, parts.length) : 1;
        for (let i = 0; i < count; i++) parts[i] = pointId(parts[i]);
        return parts.join(',');
      }).sort());
    }
    return {sourceRows, sourceCols, rows, cols, top, bottom, left, right,
      space: [top, bottom, left, right], stride, pointCount,
      cellId, pointId, centerId, remapLayer, remapAnswer};
  }
  const api = {create};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SudokuPadLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
