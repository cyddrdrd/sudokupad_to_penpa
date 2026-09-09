/* Native Penpa drawing entries which remain visible above solver Surface fills. */
(function (root) {
  'use strict';

  const SOURCE_CELL = 64;
  const layerOrder = ['background', 'underlay', 'cell-colors', 'arrows', 'cages', 'cell-grids', 'overlay', 'notes'];
  const roundStyles = [[1, 7], [2, 4], [3, 2], [5, 21]];
  const integer = value => Number.isInteger(value);
  const enabled = value => [true, 1, '1', 'true'].includes(value);

  function pointId(point, rows, cols) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) return null;
    const [r, c] = point;
    if (r < 0 || c < 0 || r > rows || c > cols) return null;
    const stride = cols + 4, count = stride * (rows + 4);
    if (integer(r - .5) && integer(c - .5)) return (r + 1.5) * stride + c + 1.5;
    if (integer(r) && integer(c)) return count + (r + 1) * stride + c + 1;
    // Penpa's edge-midpoint bands have special half-segment cap behavior.
    // Keep those and arbitrary drawing coordinates in the image for now.
    return null;
  }

  function outerFrame(part, rows, cols) {
    const points = part?.wayPoints;
    if (part?.target !== 'cell-grids' || !Array.isArray(points) || points.length !== 5 ||
      !points.every(p => Array.isArray(p) && p.length === 2 &&
        [0, rows].includes(p[0]) && [0, cols].includes(p[1])) ||
      points[0][0] !== points[4][0] || points[0][1] !== points[4][1] ||
      new Set(points.slice(0, 4).map(point => point.join(','))).size !== 4) return false;
    return points.slice(1).every(([r, c], index) => r === points[index][0] || c === points[index][1]);
  }

  function lineStyle(part, cellSize, frame = false) {
    if (!part || typeof part !== 'object' || Array.isArray(part) || part.d ||
      !['arrows', 'cell-grids'].includes(part.target ?? 'arrows') ||
      (part.fill !== undefined && !['none', 'transparent', ''].includes(part.fill)) ||
      (part.opacity !== undefined && Number(part.opacity) !== 1) ||
      (part['stroke-opacity'] !== undefined && Number(part['stroke-opacity']) !== 1) ||
      (part['stroke-linecap'] !== undefined && part['stroke-linecap'] !== 'round') ||
      (part['stroke-linejoin'] !== undefined && part['stroke-linejoin'] !== 'round') ||
      (part['stroke-dasharray'] !== undefined && part['stroke-dasharray'] !== 'none') ||
      (part['stroke-dashoffset'] !== undefined && Number(part['stroke-dashoffset']) !== 0)) return null;
    // Retain exact colors. Translucent strokes need a complete path rather
    // than separately painted segments at shared endpoints.
    const color = part.color ?? part.stroke;
    if (typeof color !== 'string' || !/^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|black|white|red|green|blue|gray|grey|orange|purple|pink|yellow|brown)$/i.test(color)) return null;
    let sourceWidth = Number(part['stroke-width'] ?? part.thickness ?? 1);
    if (part.thickness === 1 && part['stroke-width'] === undefined) sourceWidth = 2;
    if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return null;
    const width = sourceWidth * cellSize / SOURCE_CELL;
    const [nativeWidth, style] = roundStyles.reduce((best, entry) =>
      Math.abs(entry[0] - width) < Math.abs(best[0] - width) ? entry : best);
    // Penpa offers fixed widths, so convert only visually close matches.
    // A complete grid frame must also survive Surface fills. Penpa has no
    // four-pixel style: its five-pixel frame is the nearest available match
    // for e.g. a 7.2-source-pixel border scaled to 4.275 pixels. Restrict the
    // wider one-pixel tolerance to the exact outer rectangle, not clue lines.
    if (Math.abs(nativeWidth - width) > Math.max(frame ? 1 : .4, width * .1)) return null;
    return {style, color, sourceWidth, nativeWidth};
  }

  function bounds(part) {
    const points = part && Array.isArray(part.wayPoints) && part.wayPoints;
    if (!points?.length || !points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return null;
    const width = Math.max(0, Number(part['stroke-width'] ?? part.thickness ?? 1)) || 0;
    return {left: Math.min(...points.map(p => p[1])) * SOURCE_CELL - width / 2,
      right: Math.max(...points.map(p => p[1])) * SOURCE_CELL + width / 2,
      top: Math.min(...points.map(p => p[0])) * SOURCE_CELL - width / 2,
      bottom: Math.max(...points.map(p => p[0])) * SOURCE_CELL + width / 2};
  }

  function overlaps(a, b) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
  }

  function planLines(puzzle, options = {}) {
    const rows = puzzle.cells.length, cols = puzzle.cells[0].length;
    const cellSize = options.cellSize ?? 38, parts = puzzle.lines || [];
    const line = {}, colors = {}, lineIndices = new Set(), widths = [];
    const candidates = parts.map(part => {
      const style = lineStyle(part, cellSize, outerFrame(part, rows, cols));
      if (!style || !Array.isArray(part.wayPoints) || part.wayPoints.length < 2) return null;
      const points = part.wayPoints.map(point => pointId(point, rows, cols));
      if (points.some(point => point === null)) return null;
      const segments = points.slice(1).map((point, i) => [points[i], point]).filter(([a,b]) => a !== b);
      return segments.length ? {...style, segments, bounds: bounds(part)} : null;
    });
    const paintOrder = parts.map((part, index) => index).sort((a, b) =>
      layerOrder.indexOf(parts[a]?.target ?? 'arrows') - layerOrder.indexOf(parts[b]?.target ?? 'arrows') || a - b);
    const sharedEdges = new Map();
    for (let i = 0; i < candidates.length; i++) {
      for (const [a, b] of candidates[i]?.segments || []) {
        const key = Math.min(a, b) + ',' + Math.max(a, b);
        if (!sharedEdges.has(key)) sharedEdges.set(key, []);
        sharedEdges.get(key).push(i);
      }
    }
    // A thinner repaint leaves the wider stroke visible underneath in SVG.
    // A Penpa line dictionary cannot hold both widths for the same edge.
    const incompatible = new Set();
    for (const indices of sharedEdges.values()) {
      if (new Set(indices.map(index => candidates[index].style)).size > 1) {
        for (const index of indices) incompatible.add(index);
      }
    }
    for (const index of incompatible) candidates[index] = null;
    // Background text and white masks must keep their original paint order.
    // Occlusions are measured in SudokuPad's 64-pixel source coordinates.
    const occlusions = options.occlusions || [];
    for (let at = paintOrder.length - 1; at >= 0; at--) {
      const i = paintOrder[at];
      const candidate = candidates[i];
      if (!candidate) continue;
      let blocked = occlusions.some(box => overlaps(candidate.bounds, box));
      for (let next = at + 1; !blocked && next < paintOrder.length; next++) {
        const j = paintOrder[next];
        if (!candidates[j] && typeof parts[j] === 'object') {
          const laterBounds = bounds(parts[j]);
          if (laterBounds && overlaps(candidate.bounds, laterBounds)) blocked = true;
          // An opaque raw path has no reliable bounds in this module.
          if (parts[j]?.d) blocked = true;
        }
      }
      if (!blocked && enabled(puzzle.settings?.arrowsabovelines)) {
        blocked = (puzzle.arrows || []).some(arrow => {
          const box = bounds(arrow);
          return !box || overlaps(candidate.bounds, box);
        });
      }
      if (blocked) candidates[i] = null;
    }
    for (const i of paintOrder) {
      const candidate = candidates[i];
      if (!candidate) continue;
      lineIndices.add(i);
      widths.push({index: i, sourceWidth: candidate.sourceWidth, nativeWidth: candidate.nativeWidth});
      for (const [a, b] of candidate.segments) {
        const key = Math.min(a, b) + ',' + Math.max(a, b);
        // Re-inserting retains the source paint order at differently colored
        // joins, including a repeated edge painted later in the same puzzle.
        delete line[key]; delete colors[key];
        line[key] = candidate.style;
        colors[key] = candidate.color;
      }
    }
    return {line, colors, lineIndices, widths, usesCustomColors: lineIndices.size > 0};
  }

  root.SudokuPadNative = {planLines, pointId};
})(globalThis);
