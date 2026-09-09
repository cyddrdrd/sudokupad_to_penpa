/*
 * Unmodified Penpa+ point/frame/draw methods used only as a rendering oracle.
 * Sources: docs/js/class_p.js and docs/js/class_square.js at upstream commit
 * 34e3fe97804e518288870b70d919e7e76ee18b4d (Penpa+ 3.2.4).
 * https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d
 * See PENPA-LICENSE.txt. Other drawing/UI methods are stubbed in surface.cjs.
 */
const MAX_EXPORT_LENGTH = 7360;

class Point {
    constructor(x, y, type, adjacent, surround, use, neighbor = [], adjacent_dia = [], type2 = 0, index = null, edge_to_vertex = []) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.type2 = type2;
        this.adjacent = adjacent;
        this.adjacent_dia = adjacent_dia;
        this.surround = surround;
        this.neighbor = neighbor;
        this.edge_to_vertex = edge_to_vertex;
        this.use = use;
        this.index = index;
    }
}
class PenpaSurfaceReference {
    create_point() {
        var k = 0;
        var nx = this.nx0;
        var ny = this.ny0;
        var adjacent, surround, type, use, neighbor, adjacent_dia, edge_to_vertex;
        var point = [];
        const index = (x, y) => [x, y, this.nx0 * y + x];
        //center
        type = 0;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                adjacent = [k - nx, k - 1, k + 1, k + nx];
                adjacent_dia = [k - nx - 1, k - nx + 1, k + nx - 1, k + nx + 1];
                surround = [k + nx * ny - nx - 1, k + nx * ny - nx, k + nx * ny, k + nx * ny - 1];
                neighbor = [k + 2 * nx * ny - nx, k + 2 * nx * ny, k + 3 * nx * ny - 1, k + 3 * nx * ny];
                point[k] = new Point((i + 0.5) * this.size, (j + 0.5) * this.size, type, adjacent, surround, use, neighbor, adjacent_dia, 0, index(i, j));
                k++;
            }
        }
        //vertex
        type = 1;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                adjacent = [k - nx, k - 1, k + 1, k + nx];
                adjacent_dia = [k - nx - 1, k - nx + 1, k + nx - 1, k + nx + 1];
                surround = [];
                edge_to_vertex = [k + nx * ny, k + nx * ny + 1, k + 2 * nx * ny, k + 2 * nx * ny + nx];
                point[k] = new Point(point[i + j * nx].x + 0.5 * this.size, point[i + j * nx].y + 0.5 * this.size, type, adjacent, surround, use, [], adjacent_dia, 0, index(i, j), edge_to_vertex);
                k++;
            }
        }


        //centervertex
        type = 2;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                adjacent = [k + nx, k - nx];
                surround = [];
                neighbor = [k - 2 * nx * ny, k - 2 * nx * ny + nx];
                edge_to_vertex = [k - nx * ny - 1, k - nx * ny];
                point[k] = new Point(point[i + j * nx].x, point[i + j * nx].y + 0.5 * this.size, type, adjacent, surround, use, neighbor, [], 0, index(i, j), edge_to_vertex);
                k++;
            }
        }
        type = 3;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                adjacent = [k + 1, k - 1];
                surround = [];
                neighbor = [k - 3 * nx * ny, k - 3 * nx * ny + 1];
                edge_to_vertex = [k - 2 * nx * ny - nx, k - 2 * nx * ny];
                point[k] = new Point(point[i + j * nx].x + 0.5 * this.size, point[i + j * nx].y, type, adjacent, surround, use, neighbor, [], 0, index(i, j), edge_to_vertex);
                k++;
            }
        }

        //  corner
        var r = 0.25;
        type = 4;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                neighbor = [i + j * nx];
                this.corner_table[i + j * nx] = [];
                this.corner_table[i + j * nx][point[i + j * nx].surround[0]] = k;
                this.corner_table[i + j * nx][point[i + j * nx].surround[1]] = k + 1;
                this.corner_table[i + j * nx][point[i + j * nx].surround[3]] = k + 2;
                this.corner_table[i + j * nx][point[i + j * nx].surround[2]] = k + 3;
                adjacent = [k - 4 * nx + 2, k - 3, k + 1, k + 2];
                point[k] = new Point(point[i + j * nx].x - r * this.size, point[i + j * nx].y - r * this.size, type, adjacent, [point[i + j * nx].surround[0]], use, neighbor, [], 0, index(i, j));
                k++;
                adjacent = [k - 4 * nx + 2, k - 1, k + 3, k + 2];
                point[k] = new Point(point[i + j * nx].x + r * this.size, point[i + j * nx].y - r * this.size, type, adjacent, [point[i + j * nx].surround[1]], use, neighbor, [], 0, index(i, j));
                k++;
                adjacent = [k - 2, k - 3, k + 1, k + 4 * nx - 2];
                point[k] = new Point(point[i + j * nx].x - r * this.size, point[i + j * nx].y + r * this.size, type, adjacent, [point[i + j * nx].surround[3]], use, neighbor, [], 0, index(i, j));
                k++;
                adjacent = [k - 2, k - 1, k + 3, k + 4 * nx - 2];
                point[k] = new Point(point[i + j * nx].x + r * this.size, point[i + j * nx].y + r * this.size, type, adjacent, [point[i + j * nx].surround[2]], use, neighbor, [], 0, index(i, j));
                k++;
            }
        }

        //  compass
        var r = 0.3;
        type = 5;
        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) {
                    use = -1;
                } else {
                    use = 1;
                }
                adjacent = [];
                surround = [];
                point[k] = new Point(point[i + j * nx].x - 0 * this.size, point[i + j * nx].y - r * this.size, type, adjacent, surround, use, [], [], 0, index(i, j));
                k++;
                point[k] = new Point(point[i + j * nx].x + r * this.size, point[i + j * nx].y - 0 * this.size, type, adjacent, surround, use, [], [], 0, index(i, j));
                k++;
                point[k] = new Point(point[i + j * nx].x - r * this.size, point[i + j * nx].y + 0 * this.size, type, adjacent, surround, use, [], [], 0, index(i, j));
                k++;
                point[k] = new Point(point[i + j * nx].x + 0 * this.size, point[i + j * nx].y + r * this.size, type, adjacent, surround, use, [], [], 0, index(i, j));
                k++;
            }
        }

        this.types = [[0], [1], [2, 3], [4], [5]];
        point = this.fill_neighbors(point);
        this.point = point;
        
    }
    fill_neighbors(point) {
        for (var i in point) {
            if (this.types[0].indexOf(point[i].type) !== -1) {
                for (let j = 0; j < point[i].neighbor.length; j++) {
                    point[point[i].neighbor[j]].neighbor.push(parseInt(i));
                }
                for (let j = 0; j < point[i].surround.length; j++) {
                    point[point[i].surround[j]].neighbor.push(parseInt(i));
                }
            }
        }
        for (var i in point) {
            if (this.types[1].indexOf(point[i].type) !== -1 || this.types[2].indexOf(point[i].type) !== -1) {
                point[i].neighbor = [...new Set(point[i].neighbor)];
            }
        }
        return point;
    }

    // For this function to work correctly, cells need to have their surrond to be exact and their neighbor to contain all correct edges (there may be more edges than the correct ones)
    make_frameline() {
        var gr = 1; // Solid line
        var ot = 2; // Thick line
        if (this.mode.grid[0] === "2") {
            gr = 11; // Dotted line
        } else if (this.mode.grid[0] === "3") {
            gr = 0; // No line
        }
        if (this.mode.grid[2] === "2") { // No Frame
            ot = gr; // The line frame is the same line as the inside
        }
        var max, min, key, corner;
        this.frame = {};
        for (var j = 0; j < this.centerlist.length; j++) {
            corner = this.point[this.centerlist[j]].surround.length;
            for (var i = 0; i < corner; i++) {
                max = Math.max(this.point[this.centerlist[j]].surround[i], this.point[this.centerlist[j]].surround[(i + 1) % corner]);
                min = Math.min(this.point[this.centerlist[j]].surround[i], this.point[this.centerlist[j]].surround[(i + 1) % corner]);
                key = min.toString() + "," + max.toString();
                if (this.frame[key]) {
                    this.frame[key] = gr;
                } else {
                    this.frame[key] = ot;
                }
            }
        }
        this.cellsoutsideFrame = [];
        if (this.grid_is_square()) {
            for (var i = 1; i < this.nx0 - 1; i++) {
                // Cell Center
                let cell_firstrow = i + 1 * this.nx0;
                let cell_lastrow = i + (this.ny0 - 2) * this.nx0;
                this.cellsoutsideFrame.push(cell_firstrow);
                this.cellsoutsideFrame.push(cell_lastrow);

                // Left and Right Edges of first row cell
                let lr_firstrow = this.point[cell_firstrow].neighbor.sort(function(a, b) {
                    return b - a; // Descending
                }).slice(0, 2);
                this.cellsoutsideFrame.push(lr_firstrow[0], lr_firstrow[1]);

                // Left and Right Edges of last row cell
                let lr_lastrow = this.point[cell_lastrow].neighbor.sort(function(a, b) {
                    return b - a; // Descending
                }).slice(0, 2);
                this.cellsoutsideFrame.push(lr_lastrow[0], lr_lastrow[1]);
            }
            for (var j = 1; j < this.ny0 - 1; j++) {
                // Cell Center
                let cell_firstcol = 1 + j * this.nx0;
                let cell_lastcol = this.nx0 - 2 + j * this.nx0;
                this.cellsoutsideFrame.push(cell_firstcol);
                this.cellsoutsideFrame.push(cell_lastcol);

                // Top and bottom Edges of first column cell
                let lr_firstcol = this.point[cell_firstcol].neighbor.sort(function(a, b) {
                    return a - b; // Ascending
                }).slice(0, 2);
                this.cellsoutsideFrame.push(lr_firstcol[0], lr_firstcol[1]);

                // Top and bottom Edges of last column cell
                let lr_lastcol = this.point[cell_lastcol].neighbor.sort(function(a, b) {
                    return a - b; // Ascending
                }).slice(0, 2);
                this.cellsoutsideFrame.push(lr_lastcol[0], lr_lastcol[1]);
            }
        }

        // Remove duplicates
        this.cellsoutsideFrame = [...new Set(this.cellsoutsideFrame.sort(function(a, b) {
            return a - b; // Ascending
        }))]
    }
    draw_frame() {
        for (var i in this.frame) {
            if (this.frame[i] && !this.pu_q.deletelineE[i]) {
                set_line_style(this.ctx, this.frame[i]);
                var i1 = i.split(",")[0];
                var i2 = i.split(",")[1];
                this.ctx.beginPath();
                this.ctx.moveTo(this.point[i1].x, this.point[i1].y);
                this.ctx.lineTo(this.point[i2].x, this.point[i2].y);
                this.ctx.stroke();
            }
        }
    }
    draw() {
        var present_mode = this.mode.qa;
        if (present_mode !== "pu_q" || UserSettings.show_solution) {
            this.draw_frameBold();
            this.draw_surface("pu_q");
            this.draw_surface("pu_a");
            this.draw_conflicts();
            this.draw_symbol("pu_q", 1);
            this.draw_symbol("pu_a", 1);
            this.draw_squareframe("pu_q");
            this.draw_squareframe("pu_a");
            this.draw_thermo("pu_q");
            this.draw_thermo("pu_a");
            this.draw_nobulbthermo("pu_q");
            this.draw_nobulbthermo("pu_a");
            this.draw_arrowsp("pu_q");
            this.draw_arrowsp("pu_a");
            this.draw_wall("pu_q");
            this.draw_wall("pu_a");
            this.draw_direction("pu_q");
            this.draw_direction("pu_a");
            this.draw_frame();
            this.draw_polygonsp("pu_q");
            this.draw_polygonsp("pu_a");
            this.draw_line("pu_q");
            this.draw_line("pu_a");
            this.draw_lattice();
            this.draw_selection();
            this.draw_number_circle("pu_q");
            this.draw_number_circle("pu_a");
            this.draw_symbol("pu_q", 2);
            this.draw_symbol("pu_a", 2);
            this.draw_cage("pu_q");
            this.draw_cage("pu_a");
            this.draw_number("pu_q");
            this.draw_number("pu_a");
            this.draw_cursol();
            this.draw_freecircle();
        } else {
            this.draw_frameBold();
            this.draw_surface("pu_q");
            this.draw_symbol("pu_q", 1);
            this.draw_squareframe("pu_q");
            this.draw_thermo("pu_q");
            this.draw_nobulbthermo("pu_q");
            this.draw_arrowsp("pu_q");
            this.draw_wall("pu_q");
            this.draw_frame();
            this.draw_polygonsp("pu_q");
            this.draw_line("pu_q");
            this.draw_direction("pu_q");
            this.draw_lattice();
            this.draw_selection();
            this.draw_number_circle("pu_q");
            this.draw_symbol("pu_q", 2);
            this.draw_cage("pu_q");
            this.draw_number("pu_q");
            this.draw_cursol();
            this.draw_freecircle();
        }
    }
}
globalThis.PenpaSurfaceReference = PenpaSurfaceReference;
