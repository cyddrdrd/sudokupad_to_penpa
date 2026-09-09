/*
 * Unmodified Penpa+ resize/translation methods used only as a rendering oracle.
 * Source: docs/js/class_p.js at upstream commit
 * 34e3fe97804e518288870b70d919e7e76ee18b4d (Penpa+ 3.2.4).
 * https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d
 * See PENPA-LICENSE.txt. Canvas/UI operations are stubbed in adapter.cjs.
 */
class PenpaResizeReference {
    make_resize_point_translator(side, sign, originalnx0, originalny0) {
        const stride = originalnx0 * originalny0;
        if (side === 't') {
            // Shift point to the next row
            return (k) => {
                if (k >= 0) {
                    k = parseInt(k);
                    let band = Math.floor(k / stride);
                    let offset = [1, 2, 3, 4, 8, 8, 8, 8, 12, 12, 12, 12][band] * originalnx0 || 0;
                    return k + offset * sign;
                } else {
                    return k;
                }
            }
        }
        if (side === 'b') {
            // Maintain point in the same row
            return (k) => {
                if (k >= 0) {
                    k = parseInt(k);
                    let band = Math.floor(k / stride);
                    let offset = [0, 1, 2, 3, 4, 4, 4, 4, 8, 8, 8, 8][band] * originalnx0 || 0;
                    return k + offset * sign;
                } else {
                    return k;
                }
            }
        }
        if (side === 'l') {
            // Shift point to next column
            return (k) => {
                if (k >= 0) {
                    k = parseInt(k);
                    let factor = Math.floor(k / stride);
                    let typeOffset = [0, 1, 2, 3, 4, 4, 4, 4, 8, 8, 8, 8][factor] || 0;
                    let pointsPerType = [1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4][factor] || 1;
                    let normal_cursor = parseInt((k - typeOffset * stride) / pointsPerType);
                    let offset = (parseInt(normal_cursor / originalnx0) + 1) * pointsPerType + typeOffset * originalny0;
                    return k + offset * sign;
                } else {
                    return k;
                }
            }
        }
        if (side === 'r') {
            // Maintain point in the same column
            return (k) => {
                if (k >= 0) {
                    k = parseInt(k);
                    let factor = Math.floor(k / stride);
                    let typeOffset = [0, 1, 2, 3, 4, 4, 4, 4, 8, 8, 8, 8][factor] || 0;
                    let pointsPerType = [1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4][factor] || 1;
                    let normal_cursor = parseInt((k - typeOffset * stride) / pointsPerType);
                    let offset = (parseInt(normal_cursor / originalnx0)) * pointsPerType + typeOffset * originalny0;
                    return k + offset * sign;
                } else {
                    return k;
                }
            }
        }
    }

    resize_board(side, sign, celltype = 'black') {
        let originalspace = [...this.space];
        if (celltype === 'white') {
            let spaceSide = ['t', 'b', 'l', 'r'].indexOf(side);
            // Over, under, left, right
            if (sign === 1) {
                this.space[spaceSide] = this.space[spaceSide] + 1;
            } else {
                if (this.space[spaceSide] > 0) {
                    this.space[spaceSide] = this.space[spaceSide] - 1;
                } else {
                    return; // Protect board content
                }
            }
        }
        let originalnx0 = parseInt(this.nx0);
        let originalny0 = parseInt(this.ny0);

        if (side === 't' || side === 'b') {
            this.ny = this.ny + (1 * sign); // Rows, Adding/Removing 1 row
            this.ny0 = this.ny + 4;
            if ((this.get_orientation('t') % 2) === 0) {
                this.height0 = this.ny + 1;
                this.height_c = this.height0;
                this.height = this.height_c;
                this.canvasy = this.height_c * this.size;
            } else {
                this.width0 = this.ny + 1;
                this.width_c = this.width0;
                this.width = this.width_c;
                this.canvasx = this.width_c * this.size;
            }
        } else {
            this.nx = this.nx + (1 * sign); // Columns, Adding/Removing 1 column
            this.nx0 = this.nx + 4;
            if ((this.get_orientation('r') % 2) === 0) {
                this.width0 = this.nx + 1;
                this.width_c = this.width0;
                this.width = this.width_c;
                this.canvasx = this.width_c * this.size;
            } else {
                this.height0 = this.nx + 1;
                this.height_c = this.height0;
                this.height = this.height_c;
                this.canvasy = this.height_c * this.size;
            }
        }

        // Find the missing and added boxes
        let old_centerlist = this.centerlist;
        let old_idealcenterlist = []; // If no box was missing
        for (let j = 2 + originalspace[0]; j < originalny0 - 2 - originalspace[1]; j++) {
            for (let i = 2 + originalspace[2]; i < originalnx0 - 2 - originalspace[3]; i++) { // the top and left edges are unused
                old_idealcenterlist.push(i + j * originalnx0);
            }
        }
        let boxremove = old_idealcenterlist.filter(x => old_centerlist.indexOf(x) === -1);
        let boxadd = old_centerlist.filter(x => old_idealcenterlist.indexOf(x) === -1);

        this.create_point();
        this.centerlist = [];
        // Create full centerlist to allow correct board centering
        for (var j = 2; j < this.ny0 - 2; j++) {
            for (var i = 2; i < this.nx0 - 2; i++) {
                this.centerlist.push(i + j * (this.nx0));
            }
        }

        this.search_center();
        this.center_n0 = this.center_n;
        this.canvasxy_update();
        this.canvas_size_setting();
        this.point_move((this.canvasx * 0.5 - this.point[this.center_n].x + 0.5), (this.canvasy * 0.5 - this.point[this.center_n].y + 0.5), this.theta);
        if (this.reflect[0] === -1) {
            this.point_reflect_LR();
        }
        if (this.reflect[1] === -1) {
            this.point_reflect_UD();
        }

        // Translate function
        const translate_fn = this.make_resize_point_translator(side, sign, originalnx0, originalny0);

        // Reset centerlist to match the margins
        this.centerlist = []
        for (let j = 2 + this.space[0]; j < this.ny0 - 2 - this.space[1]; j++) {
            for (let i = 2 + this.space[2]; i < this.nx0 - 2 - this.space[3]; i++) { // the top and left edges are unused
                this.centerlist.push(i + j * (this.nx0));
            }
        }

        // Remove Box elements
        for (let n = 0; n < boxremove.length; n++) {
            let num = boxremove[n];
            let m = translate_fn(num);
            let index = this.centerlist.indexOf(m);
            if (index !== -1) {
                this.centerlist.splice(index, 1);
            }
        }

        // Add Box elements
        for (let n = 0; n < boxadd.length; n++) {
            let num = boxadd[n];
            let m = translate_fn(num);
            let index = this.centerlist.indexOf(m);
            if (index === -1) {
                this.centerlist.push(m);
            }
        }

        this.make_frameline();
        this.translate_puzzle_elements(translate_fn);
    }

    translate_puzzle_elements(translate_fn) {
        this.cursol = translate_fn(this.cursol);
        this.cursolS = translate_fn(this.cursolS);
        this.freelinecircle_g[0] = translate_fn(this.freelinecircle_g[0]);
        this.freelinecircle_g[1] = translate_fn(this.freelinecircle_g[1]);
        this.selection = this.selection.map(translate_fn);
        this.conflict_cells = this.conflict_cells.map(translate_fn);

        let pu_qa = ["pu_q", "pu_a", "pu_q_col", "pu_a_col"];

        for (let i of pu_qa) {
            // Translate redo/undo/replay buffer
            for (let commandstack of ['command_redo', 'command_undo', 'command_replay']) {
                for (let a of this[i][commandstack].__a) {
                    if (a && a.length >= 4) {
                        // ['line', '25,39', ... ]
                        if (typeof a[1] === 'string') {
                            a[1] = a[1].split(',').map(translate_fn).join(',');
                        }
                        // ['arrows', -1, [216, ... ], ...]
                        else if (a[1] === -1) {
                            if (a[2]) {
                                for (let a2 in a[2]) {
                                    a[2][a2] = translate_fn(a[2][a2]);
                                }
                            }
                        } else {
                            a[1] = translate_fn(a[1]);
                        }
                    }
                }
            }

            // Translate point features
            for (let feature of ['surface', 'number', 'numberS', 'symbol']) {
                if (this[i][feature]) {
                    let temp = this[i][feature];
                    this[i][feature] = {};
                    let keys = Object.keys(temp);
                    for (let k = 0; k < keys.length; k++) {
                        let m = translate_fn(keys[k]);
                        this[i][feature][m] = temp[keys[k]];
                    }
                }
            }

            // Translate point-pair features
            for (let feature of ['line', 'lineE', 'deletelineE', 'wall', 'cage']) {
                if (this[i][feature]) {
                    let temp = this[i][feature];
                    this[i][feature] = {};
                    for (let k in temp) {
                        if (k.includes(',')) {
                            let k1 = translate_fn(k.split(",")[0]);
                            let k2 = translate_fn(k.split(",")[1]);
                            let key = (k1.toString() + "," + k2.toString());
                            this[i][feature][key] = temp[k];
                        } else { // Exception for 'x' mark
                            let m = translate_fn(k);
                            this[i][feature][m] = temp[k];
                        }
                    }
                }
            }

            // Translate point array features
            for (let feature of ['thermo', 'nobulbthermo', 'arrows', 'direction', 'squareframe', 'killercages', 'polygon']) {
                if (this[i][feature]) {
                    let temp = this[i][feature];
                    this[i][feature] = new Array(temp.length);
                    for (let k in temp) {
                        if (Array.isArray(temp[k])) {
                            for (let m = 0; m <= (temp[k].length - 1); m++) {
                                temp[k][m] = translate_fn(temp[k][m]);
                            }
                        }
                        this[i][feature][k] = temp[k];
                    }
                }
            }
        }

        // Translate solution
        if (this.solution) {
            let settingstatus_or = document.getElementById("answersetting").getElementsByClassName("solcheck_or");

            if (!this.multisolution) {
                let sol = JSON.parse(this.solution);
                for (let sol_count in sol) {
                    if (sol[sol_count]) {
                        switch (parseInt(sol_count)) {
                            case 0: // shading
                                for (let i in sol[sol_count]) {
                                    sol[sol_count][i] = translate_fn(sol[sol_count][i]).toString();
                                }
                                break;
                            case 1: // Line / FreeLine
                            case 2: // Edge / FreeEdge
                            case 3: // Wall
                                for (let i in sol[sol_count]) {
                                    let parts = sol[sol_count][i].split(",");
                                    parts[0] = translate_fn(parts[0]);
                                    parts[1] = translate_fn(parts[1]);
                                    sol[sol_count][i] = parts.join(",");
                                }
                                break;
                            case 4: // Number
                                for (let i in sol[sol_count]) {
                                    let parts = sol[sol_count][i].split(",");
                                    parts[0] = translate_fn(parts[0]);
                                    sol[sol_count][i] = parts.join(",");
                                }
                                break;
                            case 5: // Symbol
                                for (let i in sol[sol_count]) {
                                    sol[sol_count][i] = translate_fn(sol[sol_count][i]).toString();
                                }
                                break;
                        }
                        sol[sol_count].sort();
                    }
                }
                pu.solution = JSON.stringify(sol);
            } else {
                let sol = this.solution;
                let sol_count = -1; // as list indexing starts at 0

                // loop through and check which "OR" settings are selected
                for (let m = 0; m < settingstatus_or.length; m++) {
                    if (settingstatus_or[m].checked) {

                        // incrementing solution count by 1
                        sol_count++;

                        // Extracting the checkbox id. First 7 chracters "sol_or_" are sliced.
                        let sol_id = settingstatus_or[m].id.slice(7);
                        switch (sol_id) {
                            case "surface":
                                for (let i in sol[sol_count]) {
                                    sol[sol_count][i] = translate_fn(sol[sol_count][i]).toString();
                                }
                                break;
                            case "number":
                                for (let i in sol[sol_count]) {
                                    let parts = sol[sol_count][i].split(",");
                                    parts[0] = translate_fn(parts[0]);
                                    sol[sol_count][i] = parts.join(",");
                                }
                                break;
                            case "loopline":
                            case "loopedge":
                            case "wall":
                                for (let i in sol[sol_count]) {
                                    let parts = sol[sol_count][i].split(",");
                                    parts[0] = translate_fn(parts[0]);
                                    parts[1] = translate_fn(parts[1]);
                                    sol[sol_count][i] = parts.join(",");
                                }
                                break;
                            case "square":
                            case "circle":
                            case "tri":
                            case "arrow":
                            case "math":
                            case "battleship":
                            case "tent":
                            case "star":
                            case "akari":
                            case "mine":
                                for (let i in sol[sol_count]) {
                                    sol[sol_count][i] = translate_fn(sol[sol_count][i]).toString();
                                }
                                break;
                        }
                        sol[sol_count].sort();
                    }
                }
            }
        }
    }
}
globalThis.PenpaResizeReference = PenpaResizeReference;
