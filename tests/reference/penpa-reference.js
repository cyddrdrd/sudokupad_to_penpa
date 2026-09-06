/*
 * Selected unmodified Penpa+ methods, used as an independent test oracle.
 * Source: https://github.com/swaroopg92/penpa-edit/blob/34e3fe97804e518288870b70d919e7e76ee18b4d/docs/js/class_p.js
 * Upstream commit: 34e3fe97804e518288870b70d919e7e76ee18b4d (3.2.4).
 * See PENPA-LICENSE.txt. Browser UI dependencies are stubbed by ../harness.cjs.
 * These are reference methods, never loaded by the production converter.
 */
class Stack {
    constructor() {
        this.__a = [];
    }

    set(list) {
        this.__a = list;
    }

    push(o) {
        // [SG] Removing the limit condition by commenting this
        // if (this.__a.length > 5000) {
        //     this.__a.shift();
        // }
        this.__a.push(o);
    }

    pop() {
        if (this.__a.length > 0) {
            return this.__a.pop();
        }
        return null;
    }

    size() {
        return this.__a.length;
    }

    toString() {
        return '[' + this.__a.join(',') + ']';
    }
}

COMPRESS_SUB = [
    ["z", "zZ"],
    ["\"qa\"", "z9"],
    ["\"pu_q\"", "zQ"],
    ["\"pu_a\"", "zA"],
    ["\"grid\"", "zG"],
    ["\"edit_mode\"", "zM"],
    ["\"surface\"", "zS"],
    ["\"line\"", "zL"],
    ["\"lineE\"", "zE"],
    ["\"wall\"", "zW"],
    ["\"cage\"", "zC"],
    ["\"number\"", "zN"],
    ["\"symbol\"", "zY"],
    ["\"special\"", "zP"],
    ["\"board\"", "zB"],
    ["\"command_redo\"", "zR"],
    ["\"command_undo\"", "zU"],
    ["\"command_replay\"", "z8"],
    ["\"numberS\"", "z1"],
    ["\"freeline\"", "zF"],
    ["\"freelineE\"", "z2"],
    ["\"thermo\"", "zT"],
    ["\"arrows\"", "z3"],
    ["\"direction\"", "zD"],
    ["\"squareframe\"", "z0"],
    ["\"polygon\"", "z5"],
    ["\"deletelineE\"", "z4"],
    ["\"killercages\"", "z6"],
    ["\"nobulbthermo\"", "z7"],
    ["\"__a\"", "z_"],
    ["null", "zO"],
];

class Puzzle {
    constructor(gridtype) {
        this.gridtype = gridtype;
        this.resol = 2.5; //window.devicePixelRatio || 1;
        this.canvasx = 0; //predefine
        this.canvasy = 0; //predefine
        this.center_n = 0;
        this.center_n0 = 0;
        this.margin = 6;

        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.obj = document.getElementById("dvique");

        // Background image properties
        this.bg_image = null;
        this.bg_image_data = {
            url: null,
            x: 0,
            y: 0,
            width: undefined,
            height: undefined,
            opacity: 100,
            foreground: true,
            mask_white: true,
        };
        this.bg_image_canvas = null;

        // Drawing position
        this.mouse_mode = "";
        this.mouse_click = 0; // 0 for left, 2 for right
        this.mouse_click_last = 0; // 0 for left, 2 for right
        this.selection = [];
        this.cageselection = [];
        this.last = -1;
        this.lastx = -1;
        this.lasty = -1;
        this.first = -1;
        this.start_point = {}; //for move_redo
        this.drawing = false;
        this.drawing_mode = -1;
        this.cursol = 0;
        this.cursolS = 0;
        this.old_selection = null;
        this.rect_select_base = null;
        this.rect_surface_draw = false;
        this.select_remove = false;
        this.surface_remove = false;
        this.panelflag = false;
        this.corner_table = []; // Table for quick lookup for cage drawing. First coordinate is cell, second is vertex
        this.types = [[0], [1], [2, 3, 4], [6], [5]]; // In order: cells, vertices, edges, corners, compass
        this.custom_colors = {};
        // Drawing mode
        this.mmode = ""; // Problem mode
        this.mode = {
            "qa": "pu_q",
            "grid": ["1", "2", "1"], //grid,lattice,out
            "pu_q": {
                "edit_mode": "surface",
                "surface": ["", 1],
                "multicolor": ["", 1],
                "line": ["1", 2],
                "lineE": ["1", 2],
                "wall": ["", 2],
                "cage": ["1", 10],
                "number": ["1", 1],
                "symbol": ["circle_L", 1],
                "special": ["thermo", ""],
                "board": ["", ""],
                "move": ["1", ""],
                "combi": ["battleship", 3],
                "sudoku": ["1", 1]
            },
            "pu_a": {
                "edit_mode": "surface",
                "surface": ["", 1],
                "multicolor": ["", 1],
                "line": ["1", 3],
                "lineE": ["1", 3],
                "wall": ["", 3],
                "cage": ["1", 10],
                "number": ["1", 2],
                "symbol": ["circle_L", 1],
                "special": ["thermo", ""],
                "board": ["", ""],
                "move": ["1", ""],
                "combi": ["battleship", 3],
                "sudoku": ["1", 9]
            }
        };
        this.theta = 0;
        this.reflect = [1, 1];
        this.centerlist = [];
        this.solution = "";
        this.sol_flag = 0;
        this.undoredo_counter = 0;
        this.loop_counter = false;
        this.rules = "";
        this.gridmax = {
            'square': 100,
            'hex': 20,
            'tri': 20,
            'pyramid': 20,
            'cube': 20,
            'kakuro': 100,
            'tetrakis': 20,
            'truncated': 20,
            'snub': 20,
            'cairo': 20,
            'rhombitrihex': 20,
            'deltoidal': 20,
            'penrose': 20
        }; // also defined in general.js
        this.version = [3, 2, 4]; // Also defined in HTML Script Loading in header tag to avoid Browser Cache Problems
        this.undoredo_disable = false;
        this.comp = false;
        this.multisolution = false;
        this.borderwarning = true;
        this.user_tags = [];
        this.conflicts = new Conflicts(this);
        this.previous_sol = [];
        this.conflict_cells = [];
        this.conflict_cell_values = [];
        this.url = [];
        this.ignored_line_types = {
            2: 1, // Black color
            5: 1, // Grey Color
            80: 1, // Thin
            12: 1, // Dotted
            13: 1 // Fat dots
        };
        this.replaycutoff = 60 * 60 * 1000; // 60 minutes
        this.surface_2_edge_types = ['pentominous', 'araf', 'spiralgalaxies', 'fillomino', 'compass'];
        this.isReplay = false;
        this.linedrawing = false; // Used for lineox composite mode
        document.addEventListener('copy', (e) => this.copy_handler(e));
        document.addEventListener('cut', (e) => this.cut_handler(e));
        document.addEventListener('paste', (e) => this.paste_handler(e));
    }

    reset_puzzle(p) {
        this[p] = {};
        this[p].command_redo = new Stack();
        this[p].command_undo = new Stack();
        this[p].command_replay = new Stack();
        this[p].surface = {};
        this[p].number = {};
        this[p].numberS = {};
        this[p].symbol = {};
        this[p].thermo = [];
        this[p].arrows = [];
        this[p].direction = [];
        this[p].squareframe = [];
        this[p].polygon = [];
        this[p].line = {};
        this[p].lineE = {};
        this[p].wall = {};
        this[p].cage = {};
        this[p].deletelineE = {};
        this[p].killercages = [];
        this[p].nobulbthermo = [];
    }

    __export_text_shared(multisolution) {
        var text = "";
        text = this.gridtype + "," + this.nx.toString() + "," + this.ny.toString() + "," + this.size.toString() + "," +
            this.theta.toString() + "," + this.reflect.toString() + "," + this.canvasx + "," + this.canvasy + "," + this.center_n + "," + this.center_n0 + "," +
            this.sudoku[0].toString() + "," + this.sudoku[1].toString() + "," + this.sudoku[2].toString() + "," + this.sudoku[3].toString();

        // Puzzle title
        let titleinfo = document.getElementById("saveinfotitle").value;
        text += "," + "Title: " + titleinfo.replace(/,/g, '%2C');

        // Puzzle author
        let authorinfo = document.getElementById("saveinfoauthor").value;
        text += "," + "Author: " + authorinfo.replace(/,/g, '%2C');

        // Puzzle Source
        text += "," + document.getElementById("saveinfosource").value;

        // Puzzle Rules
        let ruleinfo = document.getElementById("saveinforules").value;
        text += "," + ruleinfo.replace(/\n/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%2E').replace(/=/g, '%2F');

        // Border button status
        let border_status = UserSettings.draw_edges ? 'ON' : 'OFF';
        text += "," + border_status;

        // Multi Solution status, it will be true only when generating solution checking
        text += "," + multisolution;

        // Background image
        text += "," + encrypt_data(JSON.stringify(this.bg_image_data));

        return text + "\n";
    }

    __export_list_tab_shared() {
        var list = [];
        if (this.centerlist.length > 0) {
            list.push(this.centerlist[0]);
            for (var i = 1; i < this.centerlist.length; i++) {
                list.push(this.centerlist[i] - this.centerlist[i - 1]);
            }
        }
        var text = JSON.stringify(list) + "\n";

        // Copy the tab selector modes
        let user_choices = UserSettings.tab_settings;
        text += JSON.stringify(user_choices) + "\n";

        return text;
    }

    __export_version_shared(options = {}) {
        var text = "";

        if (!options.skipTimerPlaceholder) {
            text += JSON.stringify("x") + "\n"; // Dummy, to match the size of maketext_duplicate
        }

        text += JSON.stringify(options.comp ? "comp" : "x") + "\n";

        // Version
        text += JSON.stringify(this.version) + "\n";

        // Save submode/style/combi settings
        text += JSON.stringify(this.mode) + "\n";

        // Don't save theme setting in solving as solver might want his own theme, but having this placeholder to match the size with other url modes
        text += JSON.stringify("x") + "\n";

        // Custom Colors
        text += (UserSettings.custom_colors_on) ? "1\n" : "0\n";

        return text;
    }

    __get_answer_settings(type) {
        type = type || ""; // blank or "_or"

        // save answer check settings
        var settingstatus = document.getElementById("answersetting").getElementsByClassName("solcheck" + type);
        var answersetting = {};
        for (var i = 0; i < settingstatus.length; i++) {
            answersetting[settingstatus[i].id] = !!(settingstatus[i].checked);
        }
        return answersetting;
    }

    __export_solcheck_shared() {
        return JSON.stringify(this.__get_answer_settings()) + "\n";
    }

    __export_checker_shared() {
        var text = JSON.stringify(this.__get_answer_settings("_or")) + "\n";

        // Save genre tags
        text += JSON.stringify($('#genre_tags_opt').select2("val"));

        return text;
    }

    __export_finalize_shared(text) {
        var puzzle_data = encrypt_data(text);
        return puzzle_data;
    }

    maketext_baseurl() {
        // Replace base URL with canonical github url if shortening, so links are still valid externally
        if (UserSettings.shorten_links &&
            (location.href.startsWith('http://localhost') || location.href.startsWith('file://')))
            return 'https://swaroopg92.github.io/penpa-edit/';

        // This is to account for old links and new links together
        else if (location.hash)
            return location.href.split('#')[0];
        else
            return location.href.split('?')[0];
    }

    maketext_duplicate() {
        // if solution check exists, then read multisolution variable or else set to false
        let multi = this.solution ? this.multisolution : false;

        var text = this.__export_text_shared(multi);

        text += JSON.stringify(this.space) + "\n";
        text += JSON.stringify(this.mode) + "\n";

        var qr = this.pu_q.command_redo.__a;
        var qu = this.pu_q.command_undo.__a;
        var ar = this.pu_a.command_redo.__a;
        var au = this.pu_a.command_undo.__a;
        var are = this.pu_a.command_replay.__a;
        this.pu_q.command_redo.__a = [];
        this.pu_q.command_undo.__a = [];
        this.pu_a.command_redo.__a = [];
        if (this.mmode === "solve") {
            // Retain undo in solve mode
        } else {
            this.pu_a.command_undo.__a = [];
            this.pu_a.command_replay.__a = [];
        }
        text += JSON.stringify(this.pu_q) + "\n";
        text += JSON.stringify(this.pu_a) + "\n";
        this.pu_q.command_redo.__a = qr;
        this.pu_q.command_undo.__a = qu;
        this.pu_a.command_redo.__a = ar;
        this.pu_a.command_undo.__a = au;
        this.pu_a.command_replay.__a = are;

        text += this.__export_list_tab_shared();

        // Save timer
        if (this.mmode === "solve") {
            text += sw_timer.getTimeValues().toString(['days', 'hours', 'minutes', 'seconds', 'secondTenths']) + "\n";
        }

        text += this.__export_solcheck_shared();

        if (this.mmode !== "solve") {
            text += JSON.stringify("x") + "\n"; // dummy to compensate time saver for non solve cloning
        }

        text += this.__export_version_shared({
            skipTimerPlaceholder: true,
            comp: this.comp
        });

        qr = this.pu_q_col.command_redo.__a;
        qu = this.pu_q_col.command_undo.__a;
        ar = this.pu_a_col.command_redo.__a;
        au = this.pu_a_col.command_undo.__a;
        are = this.pu_a_col.command_replay.__a;
        this.pu_q_col.command_redo.__a = [];
        this.pu_q_col.command_undo.__a = [];
        this.pu_a_col.command_redo.__a = [];

        if (this.mmode === "solve") {
            // Retain undo in solve mode
        } else {
            this.pu_a_col.command_undo.__a = [];
            this.pu_a_col.command_replay.__a = [];
        }
        text += JSON.stringify(this.pu_q_col) + "\n";
        text += JSON.stringify(this.pu_a_col) + "\n";
        this.pu_q_col.command_redo.__a = qr;
        this.pu_q_col.command_undo.__a = qu;
        this.pu_a_col.command_redo.__a = ar;
        this.pu_a_col.command_undo.__a = au;
        this.pu_a_col.command_replay.__a = are;

        text += this.__export_checker_shared();

        // Custom Answer Message
        let custom_message = document.getElementById("custom_message").value;
        text += "\n" + custom_message.replace(/\n/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%2E').replace(/=/g, '%2F');

        for (var i = 0; i < COMPRESS_SUB.length; i++) {
            text = text.split(COMPRESS_SUB[i][0]).join(COMPRESS_SUB[i][1]);
        }

        var ba = encrypt_data(text);
        var url = this.maketext_baseurl();

        let solution_clone;
        // if solution exist then copy the solution as well
        if (this.solution) {
            if (this.multisolution) {
                solution_clone = JSON.stringify(this.solution);
            } else {
                solution_clone = this.solution;
            }
            var ba_s = encrypt_data(solution_clone);
            return url + "#m=edit&p=" + ba + "&a=" + ba_s;
        } else {
            return url + "#m=edit&p=" + ba;
        }
    }

    maketext_solve(type = "none") {
        // if solution check exists, then read multisolution variable or else set to false
        let multi = false;
        if (type === "answercheck") {
            this.checkall_status(); // this will update the multisolution status
            multi = this.multisolution;
        }

        var text = this.__export_text_shared(multi);

        text += JSON.stringify(this.space) + "\n";
        text += JSON.stringify(this.mode.grid) + "~" + JSON.stringify(this.mode["pu_a"]["edit_mode"]) + "~" + JSON.stringify(this.mode["pu_a"][this.mode["pu_a"]["edit_mode"]]) + "\n";

        var qr = this.pu_q.command_redo.__a;
        var qu = this.pu_q.command_undo.__a;
        this.pu_q.command_redo.__a = [];
        this.pu_q.command_undo.__a = [];
        text += JSON.stringify(this.pu_q) + "\n" + "\n";
        this.pu_q.command_redo.__a = qr;
        this.pu_q.command_undo.__a = qu;

        text += this.__export_list_tab_shared();
        text += this.__export_solcheck_shared();
        text += this.__export_version_shared();

        qr = this.pu_q_col.command_redo.__a;
        qu = this.pu_q_col.command_undo.__a;
        this.pu_q_col.command_redo.__a = [];
        this.pu_q_col.command_undo.__a = [];
        text += JSON.stringify(this.pu_q_col) + "\n" + "x" + "\n";
        this.pu_q_col.command_redo.__a = qr;
        this.pu_q_col.command_undo.__a = qu;

        text += this.__export_checker_shared();

        // Custom Answer Message
        if (type === "answercheck") {
            let custom_message = document.getElementById("custom_message").value;
            text += "\n" + custom_message.replace(/\n/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%2E').replace(/=/g, '%2F');
        } else {
            text += "\n" + false;
        }

        for (var i = 0; i < COMPRESS_SUB.length; i++) {
            text = text.split(COMPRESS_SUB[i][0]).join(COMPRESS_SUB[i][1]);
        }

        var url = this.maketext_baseurl();
        var ba = this.__export_finalize_shared(text);

        return url + "#m=solve&p=" + ba;
    }

    maketext_solve_solution() {
        var text_head = this.maketext_solve("answercheck");
        var text;
        text = JSON.stringify(this.make_solution());

        var ba = encrypt_data(text);
        return text_head + "&a=" + ba;
    }

    checkall_status() {
        // See if user selected any particular setting
        let answersetting = document.getElementById("answersetting");
        let settingstatus_and = answersetting.getElementsByClassName("solcheck");
        let settingstatus_or = answersetting.getElementsByClassName("solcheck_or");
        let checkall = true;
        this.multisolution = false;

        // loop through and check if any "AND" settings are selected
        for (var i = 0; i < settingstatus_and.length; i++) {
            if (settingstatus_and[i].checked) {
                checkall = false;
                break;
            }
        }

        // If checkall is still true, it means, no "AND" option was selected
        if (checkall) {
            // loop through and check if any "OR" settings are selected
            for (var i = 0; i < settingstatus_or.length; i++) {
                if (settingstatus_or[i].checked) {
                    checkall = false;
                    this.multisolution = true;
                    break;
                }
            }
        }

        return checkall;
    }

    get_surface_solution(surface_exact) {
        let solution = [];
        let pu = this.pu_a;
        for (var i in pu.surface) {
            // Exact surface colors
            if (surface_exact) {
                // Make the solution slightly smaller by adding multicolor directly into the parent array
                if (Array.isArray(pu.surface[i]))
                    solution.push([parseInt(i), ...pu.surface[i]]);
                else
                    solution.push([parseInt(i), pu.surface[i]]);
                continue;
            }
            // 1 is DG, 8 is GR, 3 is LG, 4 is BL
            let accepted_shades = [1, 3, 4, 8];

            if (this.pu_q.surface[i] && (accepted_shades.includes(this.pu_q.surface[i]))) {
                // ignore the shading if already in problem mode
            } else if (accepted_shades.includes(pu.surface[i])) {
                solution.push(i);
            }
        }
        return solution;
    }

    get_line_solution(line_ignore, line_exact) {
        let pu = this.pu_a;
        let solution = [];

        // Make a helper function to add an individual line segment based on the options chosen
        let check_line = (i, type) => {
            let l = pu[type][i];

            if (line_exact) {
                if (i.includes(',')) {
                    solution.push(i + "," + l);
                }
                return;
            }

            // Ignore "given" line segments (those which were present in the
            // original puzzle in any of a few specific styles)
            let lq = this.pu_q[type][i];
            if (line_ignore && lq && this.ignored_line_types[lq]) {
                return;
            }

            // Look for green or double lines, or if the user has ignored styles,
            // double or anything-but-double (making sure that this is an actual
            // segment and not an X or something)
            if (l === 3 || (UserSettings.ignore_line_style && l !== 30 && i.includes(',')))
                solution.push(i + ",1");
            else if (l === 30)
                solution.push(i + ",2");
        };

        for (var i in pu.line) {
            // Ignoring the half cells standred line marks
            // [ZW] Not sure about the logic for this either, why is this only
            // done if "ignore given line segments" is *not* checked?
            if (!line_ignore) {
                let cells = i.split(",");
                if (this.cellsoutsideFrame.includes(parseInt(cells[0])) &&
                    this.cellsoutsideFrame.includes(parseInt(cells[1]))) {
                    continue;
                }
            }
            check_line(i, 'line');
        }

        return solution;
    }

    get_edge_solution(edge_ignore, edge_exact) {
        let pu = this.pu_a;
        let solution = [];
        // Make a helper function to add an individual line segment based on the options chosen
        let check_edge = (i, type) => {
            let l = pu[type][i];

            if (edge_exact) {
                if (i.includes(',')) {
                    solution.push(i + "," + l);
                }
                return;
            }

            if (edge_ignore) {
                // ignore the edge if its on the border (suitable for araf, pentominous type of puzzles)
                if ((this.frame[i] && this.frame[i] === 2) ||
                    (this["pu_q"][type][i] && this["pu_q"][type][i] === 2))
                    return;
            }

            // Look for green or double edges, or if the user has ignored styles,
            // double or anything-but-double (making sure that this is an actual
            // segment and not an X or something)
            if (l === 3 || (UserSettings.ignore_line_style && l !== 30 && i.includes(',')))
                solution.push(i + ",1");
            else if (l === 30)
                solution.push(i + ",2");
        };

        for (var i in pu.lineE)
            check_edge(i, 'lineE');

        let found = $('#genre_tags_opt').select2("val").some(r => this.surface_2_edge_types.includes(r));
        if (found && this.gridtype === 'square') {
            // find out the grid position using the frame data
            // Note this section of code will work only if thick border frame exists
            if (typeof this.row_start == "undefined") {
                // Find top left corner and bottom right corner
                let topleft = 9999,
                    bottomright = 0,
                    numbers;
                for (var i in this.frame) {
                    if (i in this.pu_q.deletelineE) {
                        continue;
                    }
                    numbers = i.split(",");
                    if (topleft >= parseInt(numbers[0])) {
                        topleft = parseInt(numbers[0]);
                    }
                    if (bottomright <= parseInt(numbers[1])) {
                        bottomright = parseInt(numbers[1]);
                    }
                }
                // finding row and column indices
                let pointA, pointB;
                pointA = topleft - (this.nx0 * this.ny0);
                this.col_start = (pointA % this.nx0) - 1; //column
                this.row_start = parseInt(pointA / this.nx0) - 1; //row
                pointB = bottomright - (this.nx0 * this.ny0);
                this.col_end = (pointB % this.nx0) - 1; //column
                this.row_end = parseInt(pointB / this.nx0) - 1; //row
            }

            let present_cell, right_cell, down_cell;
            for (var j = 2 + this.row_start; j < this.row_end + 2; j++) {
                for (var i = 2 + this.col_start; i < this.col_end + 2; i++) {
                    present_cell = i + j * (this.nx0);
                    right_cell = present_cell + 1;
                    down_cell = Math.max(...this.point[present_cell].adjacent);
                    if (i != this.col_end + 1) {
                        if (pu.surface[present_cell] &&
                            pu.surface[right_cell] &&
                            (pu.surface[present_cell] !== pu.surface[right_cell])) {
                            let imp_edge = this.point[present_cell].surround[1] + ',' + this.point[present_cell].surround[2];
                            if (this["pu_q"].lineE[imp_edge] && this["pu_q"].lineE[imp_edge] === 2) {
                                // ignore given edges
                            } else {
                                solution.push(imp_edge + ',1');
                            }
                        }
                    }
                    if (j != this.row_end + 1) {
                        if (pu.surface[present_cell] &&
                            pu.surface[down_cell] &&
                            (pu.surface[present_cell] !== pu.surface[down_cell])) {
                            let imp_edge = this.point[present_cell].surround[3] + ',' + this.point[present_cell].surround[2];
                            if (this["pu_q"].lineE[imp_edge] && this["pu_q"].lineE[imp_edge] === 2) {
                                // ignore given edges
                            } else {
                                solution.push(imp_edge + ',1');
                            }
                        }
                    }
                }
            }
        }
        // Remove duplicates
        return [...new Set(solution)];
    }

    make_solution() {
        let checkall = this.checkall_status();

        if (!this.multisolution) {
            let surface_exact = document.getElementById("sol_surface_exact").checked;
            let line_exact = document.getElementById("sol_loopline_exact").checked;
            let edge_exact = document.getElementById("sol_loopedge_exact").checked;

            let line_ignore = document.getElementById("sol_ignoreloopline").checked;
            let edge_ignore = document.getElementById("sol_ignoreborder").checked;

            // 0 - shading
            // 1 - Line / FreeLine
            // 2 - Edge / FreeEdge
            // 3 - Wall
            // 4 - Number
            // 5 - Symbol
            var sol = [
                [],
                [],
                [],
                [],
                [],
                []
            ];

            var pu = "pu_a";

            if (document.getElementById("sol_surface").checked === true || surface_exact || checkall) {
                sol[0] = this.get_surface_solution(surface_exact);
            }

            // Why on earth is this put in the same list as the surface information?
            if (document.getElementById("sol_square").checked === true || checkall) {
                for (var i in this[pu].symbol) {
                    if (this[pu].symbol[i][0] === 2 && this[pu].symbol[i][1] === "square_LL") {
                        if (sol[0].indexOf(i) === -1) {
                            sol[0].push(i);
                        }
                    }
                }
            }

            if (document.getElementById("sol_loopline").checked === true ||
                line_exact || line_ignore || checkall) {
                sol[1] = this.get_line_solution(line_ignore, line_exact);
            }

            if (document.getElementById("sol_loopedge").checked === true ||
                edge_exact || edge_ignore || checkall) {
                // for newer links, if loop edge is selected, automatically ignore the given border/edge elements
                if (this.version_gt(2, 26, 20)) {
                    if (!edge_ignore && !checkall) {
                        edge_ignore = true;
                    }
                }

                sol[2] = this.get_edge_solution(edge_ignore, edge_exact);
            }

            if (document.getElementById("sol_wall").checked === true || checkall) {
                for (var i in this[pu].wall) {
                    if (this[pu].wall[i] === 3) {
                        sol[3].push(i);
                    }
                }
            }

            if (document.getElementById("sol_number").checked === true || checkall) {
                for (var i in this[pu].number) {
                    if (this["pu_q"].number[i] && this["pu_q"].number[i][1] === 1 && (this["pu_q"].number[i][2] === "1" || this["pu_q"].number[i][2] === "10")) {
                        // (Black) and (Normal or L) in Problem mode then ignore
                    } else {
                        // Sudoku only one number and multiple digits in same cell should not be considered, this is for single digit obtained from candidate submode
                        if (this[pu].number[i][2] === "7") {
                            // (Green or light blue or dark blue or red)
                            if (this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) {
                                var sum = 0,
                                    a;
                                for (var j = 0; j < 10; j++) {
                                    if (this[pu].number[i][0][j] === 1) {
                                        sum += 1;
                                        a = j + 1;
                                    }
                                }
                                if (sum === 1) {
                                    sol[4].push(i + "," + a);
                                }
                            }
                        } else if (!isNaN(this[pu].number[i][0]) || !this[pu].number[i][0].match(/[^A-Za-z]+/)) {
                            // ((Green or light blue or dark blue or red) and (Normal, M, S, L))
                            if ((this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) &&
                                (this[pu].number[i][2] === "1" || this[pu].number[i][2] === "5" || this[pu].number[i][2] === "6" || this[pu].number[i][2] === "10")) {
                                if ($('#genre_tags_opt').select2("val").includes("alphabet")) {
                                    let alphabet = this[pu].number[i][0];
                                    if (alphabet.match(/[a-zA-Z]/g)) {
                                        sol[4].push(i + "," + alphabet.toLowerCase());
                                    }
                                } else {
                                    sol[4].push(i + "," + this[pu].number[i][0]);
                                }
                            }
                        } else if ($('#genre_tags_opt').select2("val").includes("non-alphanumeric")) {
                            // ((Green or light blue or dark blue or red) and (Normal, M, S, L))
                            if ((this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) &&
                                (this[pu].number[i][2] === "1" || this[pu].number[i][2] === "5" || this[pu].number[i][2] === "6" || this[pu].number[i][2] === "10")) {
                                sol[4].push(i + "," + this[pu].number[i][0]);
                            }
                        }
                    }
                }

                // Tight Fit Sudoku
                if ($('#genre_tags_opt').select2("val").includes("tightfit")) {
                    for (var i in this[pu].numberS) {
                        if (!isNaN(this[pu].numberS[i][0]) || !this[pu].numberS[i][0].match(/[^A-Za-z]+/)) {
                            // (Green or light blue or dark blue or red)
                            if ((this[pu].numberS[i][1] === 2 || this[pu].numberS[i][1] === 8 || this[pu].numberS[i][1] === 9 || this[pu].numberS[i][1] === 10)) {
                                sol[4].push(i + "," + this[pu].numberS[i][0]);
                            }
                        }
                    }
                }
            }

            for (var i in this[pu].symbol) {
                switch (this[pu].symbol[i][1]) {
                    case "circle_M":
                        if (document.getElementById("sol_circle").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 2) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "A");
                            }
                        }
                        break;
                    case "tri":
                        if (document.getElementById("sol_tri").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 4) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "B");
                            }
                        }
                        break;
                    case "arrow_S":
                        if (document.getElementById("sol_arrow").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 8) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "C");
                            }
                        }
                        break;
                    case "battleship_B":
                        if (document.getElementById("sol_battleship").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 6) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "D");
                            }
                        }
                        break;
                    case "battleship_B+":
                        if (document.getElementById("sol_battleship").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 4) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "D+");
                            }
                        }
                        break;
                    case "star": //any star
                        if (document.getElementById("sol_star").checked === true || checkall) {
                            if (this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 3) {
                                sol[5].push(i + "," + 1 + "E");
                            }
                        }
                        break;
                    case "tents":
                        if (document.getElementById("sol_tent").checked === true || checkall) {
                            if (this[pu].symbol[i][0] === 2) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "F");
                            }
                        }
                        break;
                    case "math":
                    case "math_G":
                        if (document.getElementById("sol_math").checked === true || checkall) {
                            if (this[pu].symbol[i][0] === 2 || this[pu].symbol[i][0] === 3) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "G");
                            }
                        }
                        break;
                    case "sun_moon":
                        if (document.getElementById("sol_akari").checked === true || checkall) {
                            if (this[pu].symbol[i][0] === 3) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "H");
                            }
                        }
                        if (document.getElementById("sol_mine").checked === true || checkall) {
                            if (this[pu].symbol[i][0] === 4 || this[pu].symbol[i][0] === 5) {
                                sol[5].push(i + "," + this[pu].symbol[i][0] + "I");
                            }
                        }
                        break;
                }
            }

            for (var i = 0; i < 6; i++) {
                sol[i] = sol[i].sort();
            }
        } else {
            // store multiple solutions

            var sol = [];
            var pu = "pu_a";
            var sol_count = -1; // as list indexing starts at 0

            // Find all checkboxes in the OR mode that are checked, and get the modes for each
            // by slicing out the first 7 characters ("sol_or_")
            let settingstatus_or = [...document.getElementById("answersetting").getElementsByClassName("solcheck_or")];
            settingstatus_or = settingstatus_or.filter(c => c.checked).map(c => c.id.slice(7));

            // loop through and check which "OR" settings are selected
            for (let sol_id of settingstatus_or) {
                // incrementing solution count by 1
                sol_count++;

                let temp_sol = [];

                switch (sol_id) {
                    case "surface":
                        temp_sol = this.get_surface_solution(false);
                        sol[sol_count] = temp_sol;
                        break;
                    case "surface_exact":
                        temp_sol = this.get_surface_solution(true);
                        sol[sol_count] = temp_sol;
                        break;
                    case "number":
                        for (var i in this[pu].number) {
                            if (this["pu_q"].number[i] && this["pu_q"].number[i][1] === 1 && (this["pu_q"].number[i][2] === "1" || this["pu_q"].number[i][2] === "10")) {
                                // (Black) and (Normal or L) in Problem mode then ignore
                            } else {
                                // Sudoku only one number and multiple digits in same cell should not be considered, this is for single digit obtained from candidate submode
                                if (this[pu].number[i][2] === "7") {
                                    // (Green or light blue or dark blue or red)
                                    if (this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) {
                                        var sum = 0,
                                            a;
                                        for (var j = 0; j < 10; j++) {
                                            if (this[pu].number[i][0][j] === 1) {
                                                sum += 1;
                                                a = j + 1;
                                            }
                                        }
                                        if (sum === 1) {
                                            temp_sol.push(i + "," + a);
                                        }
                                    }
                                } else if (!isNaN(this[pu].number[i][0]) || !this[pu].number[i][0].match(/[^A-Za-z]+/)) {
                                    // ((Green or light blue or dark blue or red) and (Normal, M, S, L))
                                    if ((this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) &&
                                        (this[pu].number[i][2] === "1" || this[pu].number[i][2] === "5" || this[pu].number[i][2] === "6" || this[pu].number[i][2] === "10")) {
                                        if ($('#genre_tags_opt').select2("val").includes("alphabet")) {
                                            let alphabet = this[pu].number[i][0];
                                            if (alphabet.match(/[a-zA-Z]/g)) {
                                                temp_sol.push(i + "," + alphabet.toLowerCase());
                                            }
                                        } else {
                                            temp_sol.push(i + "," + this[pu].number[i][0]);
                                        }
                                    }
                                } else if ($('#genre_tags_opt').select2("val").includes("non-alphanumeric")) {
                                    // ((Green or light blue or dark blue or red) and (Normal, M, S, L))
                                    if ((this[pu].number[i][1] === 2 || this[pu].number[i][1] === 8 || this[pu].number[i][1] === 9 || this[pu].number[i][1] === 10) &&
                                        (this[pu].number[i][2] === "1" || this[pu].number[i][2] === "5" || this[pu].number[i][2] === "6" || this[pu].number[i][2] === "10")) {
                                        temp_sol.push(i + "," + this[pu].number[i][0]);
                                    }
                                }
                            }
                        }

                        // Tight Fit Sudoku
                        if ($('#genre_tags_opt').select2("val").includes("tightfit")) {
                            for (var i in this[pu].numberS) {
                                if (!isNaN(this[pu].numberS[i][0]) || !this[pu].numberS[i][0].match(/[^A-Za-z]+/)) {
                                    // (Green or light blue or dark blue or red)
                                    if ((this[pu].numberS[i][1] === 2 || this[pu].numberS[i][1] === 8 || this[pu].numberS[i][1] === 9 || this[pu].numberS[i][1] === 10)) {
                                        temp_sol.push(i + "," + this[pu].numberS[i][0]);
                                    }
                                }
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "loopline_exact":
                        sol[sol_count] = this.get_line_solution(true, true);
                        break;
                    case "loopline":
                        sol[sol_count] = this.get_line_solution(true, false);
                        break;
                    case "loopedge_exact":
                        sol[sol_count] = this.get_edge_solution(true, true);
                        break;
                    case "loopedge":
                        sol[sol_count] = this.get_edge_solution(true, false);
                        break;
                    case "wall":
                        for (var i in this[pu].wall) {
                            if (this[pu].wall[i] === 3) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "square":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "square_LL" && this[pu].symbol[i][0] === 2) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "circle":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "circle_M" &&
                                this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 2) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "tri":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "tri" &&
                                this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 4) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "arrow":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "arrow_S" &&
                                this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 8) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "math":
                        for (var i in this[pu].symbol) {
                            if ((this[pu].symbol[i][1] === "math" || this[pu].symbol[i][1] === "math_G") &&
                                (this[pu].symbol[i][0] === 2 || this[pu].symbol[i][0] === 3)) {
                                temp_sol.push(i + "," + this[pu].symbol[i][0]);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "battleship":
                        for (var i in this[pu].symbol) {
                            if ((this[pu].symbol[i][1] === "battleship_B" &&
                                    this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 6) ||
                                (this[pu].symbol[i][1] === "battleship_B+" &&
                                    this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 4)) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "tent":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "tents" &&
                                this[pu].symbol[i][0] === 2) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "star":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "star" &&
                                this[pu].symbol[i][0] >= 1 && this[pu].symbol[i][0] <= 3) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "akari":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "sun_moon" &&
                                this[pu].symbol[i][0] === 3) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                    case "mine":
                        for (var i in this[pu].symbol) {
                            if (this[pu].symbol[i][1] === "sun_moon" &&
                                (this[pu].symbol[i][0] === 4 || this[pu].symbol[i][0] === 5)) {
                                temp_sol.push(i);
                            }
                        }
                        sol[sol_count] = temp_sol;
                        break;
                }
            }

            for (var i = 0; i < sol.length; i++) {
                sol[i] = sol[i].sort();
            }
        }
        return sol;
    }

    version_gt(major, minor, revision) {
        if (this.version[0] > major) return true;
        if (this.version[0] < major) return false;
        if (this.version[1] > minor) return true;
        if (this.version[1] < minor) return false;
        return this.version[2] > revision;
    }
}

globalThis.PenpaReference = { Puzzle, COMPRESS_SUB };
