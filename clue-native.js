/* Preserve plain in-cell clue labels as Penpa text above solver Surface fills. */
(function (root) {
  'use strict';

  const near = (a, b, tolerance = .012) => Math.abs(a - b) <= tolerance;
  const black = value => value === undefined || /^(?:#000000|#000|black)$/i.test(String(value));
  const visible = value => value !== undefined &&
    !/^(?:none|transparent|#[\da-f]{3}0|#[\da-f]{6}00|rgba\([^)]*[,/]\s*0(?:\.0+)?\s*\))$/i.test(String(value));
  const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const hasNotes = cell => ['pencilMarks', 'centremarks', 'candidates'].some(key =>
    Array.isArray(cell?.[key]) && cell[key].some(value => String(value ?? '').trim()));

  // Conservative bounds are used only to reject promotion. Uncertain or
  // overlapping artwork keeps its original image order and appearance.
  function shapeBoxes(part) {
    if (!Array.isArray(part?.center) || part.center.length !== 2 || Number(part.opacity ?? 1) === 0) return [];
    const [r, c] = part.center.map(Number), width = Number(part.width ?? 1), height = Number(part.height ?? 1);
    const boxes = [];
    if ((visible(part.backgroundColor ?? part.fill) && Number(part['fill-opacity'] ?? 1) !== 0) ||
        (visible(part.borderColor ?? part.stroke) && Number(part['stroke-opacity'] ?? 1) !== 0)) {
      const pad = Number(part.borderSize ?? part.thickness ?? part['stroke-width'] ?? 2) / 128;
      if (width && height) boxes.push([c - width / 2 - pad, r - height / 2 - pad,
        c + width / 2 + pad, r + height / 2 + pad]);
    }
    if (String(part.text ?? '').trim()) {
      const font = (Number(part.fontSize ?? 24) + (part.fontSize === undefined ? 0 : 4)) / 64;
      const lines = String(part.text).split(/\r?\n/), width = Math.max(...lines.map(line =>
        [...line].reduce((sum, character) => sum + (/[0-9?*+−-]/.test(character) ? .75 : 1), 0))) * font;
      const anchor = part.textAnchor ?? part['text-anchor'] ?? 'middle';
      const left = anchor === 'start' ? c : anchor === 'end' ? c - width : c - width / 2;
      const y = r + .06 * height, alphabetic = part['dominant-baseline'] === 'alphabetic';
      boxes.push([left, y - font * (alphabetic ? .85 : .6),
        left + width, y + font * (alphabetic ? .25 : .6) + (lines.length - 1) * font * 1.2]);
    }
    if (Number(part.angle || 0)) return boxes.map(box => {
      const radius = Math.max(...[box[0], box[2]].flatMap(x => [box[1], box[3]].map(y => Math.hypot(x - c, y - r))));
      return [c - radius, r - radius, c + radius, r + radius];
    });
    return boxes;
  }

  function planClues(puzzle, options = {}) {
    const rows = puzzle.cells.length, cols = puzzle.cells[0].length;
    const stride = cols + 4, pointCount = stride * (rows + 4);
    const question = {number: {}, numberS: {}}, colors = {number: {}, numberS: {}};
    const overlayIndices = [], underlayIndices = [];
    const candidates = [];
    const shapes = [...(puzzle.underlays || []).map((part, index) => ({part, index, indices: underlayIndices, layer: part?.target ?? 'underlay'})),
      ...(puzzle.overlays || []).map((part, index) => ({part, index, indices: overlayIndices, layer: part?.target ?? 'overlay'}))];

    function plan(part) {
      if (!part || typeof part !== 'object' || !Array.isArray(part.center) ||
          part.center.length !== 2 || part.center.some(value => !Number.isFinite(Number(value)))) return;
      const value = String(part.text ?? '');
      // Match plain labels, never turn styled artwork into a different font,
      // color, rotation, transparency, or mathematical arrangement.
      if (!/^[0-9?*+−-]{1,2}$/.test(value) || Number(part.angle || 0) !== 0 ||
          Number(part.opacity ?? 1) !== 1 || !black(part.textColor ?? part.color) ||
          part['font-family'] !== undefined || !['normal', '400'].includes(String(part['font-weight'] ?? 'normal')) ||
          ![undefined, 'normal'].includes(part['font-style']) || part.maxWidth !== undefined ||
          (part.textAnchor ?? part['text-anchor'] ?? 'middle') !== 'middle' ||
          (part['dominant-baseline'] ?? 'middle') !== 'alphabetic' ||
          ![undefined, 'none', '#FFFFFF', '#ffffff', 'white'].includes(part.textStroke)) return;
      if (part.target !== undefined && !['underlay', 'overlay', 'notes'].includes(part.target)) return;
      const font = (Number(part.fontSize ?? 24) + (part.fontSize === undefined ? 0 : 4)) / 64;
      if (!Number.isFinite(font) || font <= 0) return;
      const [sourceY, x] = part.center.map(Number);
      const y = sourceY + .06 * Number(part.height ?? 1);
      const row = Math.floor(y), col = Math.floor(x);
      if (row < 0 || row >= rows || col < 0 || col >= cols) return;
      const originalCell = puzzle.cells[row][col];
      if (hasNotes(originalCell) || ![undefined, null, ''].includes(originalCell?.value)) return;
      const cell = (row + 2) * stride + col + 2;
      const localX = x - col, localY = y - row;
      let entry;
      // Penpa-exported large labels use a .6-cell font and an alphabetic
      // baseline at .5 + .03 + .28*.6. The native E position alias draws at
      // the same point but does not classify this clue as a Sudoku given.
      for (const [mode, nativeFont, offset] of [['5', .25, .02], ['6', .4, .03], ['10', .6, .03], ['1', .7, .06]]) {
        if (near(font, nativeFont, .001) && near(localX, .5) && near(localY, .5 + offset + .28 * nativeFont)) {
          entry = {layer: 'number', id: cell + 'E', value: [value, 1, mode]};
          break;
        }
      }
      // Penpa's older exports used .30-cell corner text; current Penpa uses
      // .32. Preserve the native corner/compass position in either case.
      if (!entry && (near(font, .3, .001) || near(font, .32, .001))) {
        const baseline = .03 + .28 * font;
        const positions = [
          [.25, .25, 4 * pointCount + 4 * cell], [.75, .25, 4 * pointCount + 4 * cell + 1],
          [.25, .75, 4 * pointCount + 4 * cell + 2], [.75, .75, 4 * pointCount + 4 * cell + 3],
          [.5, .2, 8 * pointCount + 4 * cell], [.8, .5, 8 * pointCount + 4 * cell + 1],
          [.2, .5, 8 * pointCount + 4 * cell + 2], [.5, .8, 8 * pointCount + 4 * cell + 3]
        ];
        const position = positions.find(([xx, yy]) => near(localX, xx) && near(localY, yy + baseline));
        if (position) entry = {layer: 'numberS', id: position[2], value: [value, 1]};
      }
      return entry;
    }

    const counts = new Map();
    for (const shape of shapes) {
      shape.entry = ['overlay', 'notes'].includes(shape.layer) ? plan(shape.part) : undefined;
      if (shape.entry) {
        shape.key = shape.entry.layer + ':' + shape.entry.id;
        counts.set(shape.key, (counts.get(shape.key) || 0) + 1);
      }
    }
    for (const [order, shape] of shapes.entries()) {
      const {part, index, indices, layer} = shape;
      // Moving an actual underlay above grids, colors, and cages can reveal
      // intentionally hidden text. Only post-grid labels are eligible.
      if (!['overlay', 'notes'].includes(layer)) continue;
      const entry = shape.entry;
      if (!entry || counts.get(shape.key) !== 1) continue;
      const textBox = shapeBoxes({...part, width: 0, backgroundColor: 'none', borderColor: 'none'}).at(-1);
      const hiddenByShape = shapes.some((other, otherOrder) => otherOrder !== order &&
        ((other.layer === layer && otherOrder > order) || (layer === 'overlay' && other.layer === 'notes')) &&
        shapeBoxes(other.part).some(box => overlaps(textBox, box)));
      // Lines normally precede overlays. A line deliberately moved into the
      // notes layer may mask text; leave that unusual combination untouched.
      const laterLine = [...(puzzle.lines || []), ...(puzzle.arrows || [])].some(line =>
        line && (line.target === 'notes' || (indices === underlayIndices && line.target === layer)) && Number(line.opacity ?? 1) !== 0 &&
        (visible(line.color ?? line.stroke) || visible(line.fill)) &&
        (layer === 'overlay' || indices === underlayIndices));
      if (hiddenByShape || laterLine) continue;
      candidates.push({...entry, index, indices, key: entry.layer + ':' + entry.id});
    }
    for (const entry of candidates) {
      // Keep both overlapping labels in their original image order if they
      // compete for a single native point, rather than hiding one of them.
      if (counts.get(entry.key) !== 1) continue;
      question[entry.layer][entry.id] = entry.value;
      entry.indices.push(entry.index);
    }
    return {question, colors, overlayIndices, underlayIndices,
      count: overlayIndices.length + underlayIndices.length};
  }

  const api = {planClues};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SudokuPadNativeClues = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
