/* Imported SudokuPad artwork layer for the bundled Penpa+ 3.2.4 solver. */
(function (root) {
  'use strict';

  const installed = Symbol.for('sudokupad-to-penpa.artwork-adapter');

  function artworkMarker(puzzle) {
    const marker = puzzle.bg_image_data?.sudokupad_artwork;
    if (!marker || marker.version !== 1 || puzzle.gridtype !== 'square' ||
      !Number.isSafeInteger(marker.anchor) || marker.anchor < 0 ||
      !['offsetX', 'offsetY', 'widthCells', 'heightCells'].every(key => Number.isFinite(marker[key])) ||
      marker.widthCells <= 0 || marker.heightCells <= 0) return null;
    return marker;
  }

  function imageRect(puzzle) {
    const marker = artworkMarker(puzzle);
    if (!marker || !Number.isFinite(puzzle.size) || puzzle.size <= 0) return null;
    const anchor = puzzle.point?.[marker.anchor];
    if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return null;
    const rect = [anchor.x + marker.offsetX * puzzle.size,
      anchor.y + marker.offsetY * puzzle.size,
      marker.widthCells * puzzle.size, marker.heightCells * puzzle.size];
    return rect.every(Number.isFinite) ? rect : null;
  }

  function install(PuzzleClass, getSettings = () => typeof UserSettings === 'undefined' ? {} : UserSettings) {
    const prototype = PuzzleClass?.prototype;
    if (!prototype || typeof prototype.draw_surface !== 'function' ||
      typeof prototype.draw_bg_image !== 'function') return false;
    if (prototype[installed]) return true;
    const drawSurface = prototype.draw_surface;
    const drawBackground = prototype.draw_bg_image;
    const translateElements = prototype.translate_puzzle_elements;
    const makeSolution = prototype.make_solution;

    prototype.draw_bg_image = function (...args) {
      // Ordinary Penpa links keep their original background/foreground mode.
      if (!imageRect(this)) return drawBackground.apply(this, args);
    };

    prototype.draw_surface = function (layer, ...args) {
      const result = drawSurface.call(this, layer, ...args);
      const rect = imageRect(this);
      // The original square renderer draws both Surface layers first. Insert
      // artwork after the last visible Surface layer, before every solving
      // number, note, line and symbol. Do not repeat a full image during a
      // hypothetical single-cell partial repaint.
      const questionOnly = this.mode?.qa === 'pu_q' && !getSettings().show_solution;
      if (rect && !args[0] && layer === (questionOnly ? 'pu_q' : 'pu_a') &&
        this.bg_image && this.bg_image_canvas) {
        // Coordinates follow a real grid point and current cell size, so the
        // source illustration stays aligned when Penpa resizes its grid.
        // The original decoded image already applies opacity/white masking.
        this.ctx.drawImage(this.bg_image_canvas, ...rect);
      }
      return result;
    };

    if (typeof translateElements === 'function') {
      prototype.translate_puzzle_elements = function (translate, ...args) {
        const marker = artworkMarker(this);
        const nextAnchor = marker ? translate(marker.anchor) : null;
        const result = translateElements.call(this, translate, ...args);
        if (marker && Number.isSafeInteger(nextAnchor) && nextAnchor >= 0) {
          marker.anchor = nextAnchor;
          // Removing enough outside rows can eventually delete the original
          // anchor. Re-anchor to an existing nearby centre point before it
          // leaves Penpa's generated point grid, preserving the image position.
          const oldPoint = this.point?.[nextAnchor];
          if (oldPoint?.type === 0 && Number.isSafeInteger(this.nx0) &&
            Number.isSafeInteger(this.ny0) && this.nx0 >= 5 && this.ny0 >= 5 &&
            Number.isFinite(this.size) && this.size > 0) {
            const column = Math.min(this.nx0 - 2, Math.max(1, nextAnchor % this.nx0));
            const row = Math.min(this.ny0 - 2, Math.max(1, Math.floor(nextAnchor / this.nx0)));
            const id = row * this.nx0 + column;
            const point = this.point[id];
            if (point && id !== nextAnchor && [oldPoint.x, oldPoint.y, point.x, point.y].every(Number.isFinite)) {
              marker.offsetX += (oldPoint.x - point.x) / this.size;
              marker.offsetY += (oldPoint.y - point.y) / this.size;
              marker.anchor = id;
            }
          }
        }
        return result;
      };
    }
    if (typeof makeSolution === 'function') {
      prototype.make_solution = function (...args) {
        const answer = makeSolution.apply(this, args);
        // SudokuPad checks its source cells. Numbers written beside outside
        // clues are solving annotations, so they must not invalidate that
        // answer. Penpa's centre list follows structural board resizing.
        if (artworkMarker(this) && !this.multisolution && Array.isArray(this.centerlist) &&
          Array.isArray(answer) && Array.isArray(answer[4])) {
          const cells = new Set(this.centerlist.map(Number));
          answer[4] = answer[4].filter(entry => cells.has(Number(String(entry).split(',')[0])));
        }
        return answer;
      };
    }
    Object.defineProperty(prototype, installed, {value: true});
    return true;
  }

  root.PenpaSudokuPadAdapter = {install};
  if (typeof Puzzle !== 'undefined') install(Puzzle);
})(globalThis);
