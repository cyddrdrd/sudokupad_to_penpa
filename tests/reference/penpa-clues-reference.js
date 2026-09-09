/*
 * Unmodified Penpa+ number drawing methods used only as a rendering oracle.
 * Source: docs/js/class_square.js at upstream commit
 * 34e3fe97804e518288870b70d919e7e76ee18b4d (Penpa+ 3.2.4).
 * https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d
 * See PENPA-LICENSE.txt. Canvas text/style methods are recorded in clues.cjs.
 */
class PenpaClueReference {
    draw_number(pu) {
        /*number*/
        var p_x, p_y, factor;
        var str_alph_low = "abcdefghijklmnopqrstuvwxyz";
        for (var i in this[pu].number) {
            if (i.slice(-1) === "E") { // Overwriting in Edge Mode
                p_x = this.point[i.slice(0, -1)].x;
                p_y = this.point[i.slice(0, -1)].y;
            } else {
                p_x = this.point[i].x;
                p_y = this.point[i].y;
            }
            // if its lower case
            if (str_alph_low.indexOf(this[pu].number[i][0]) === -1) {
                factor = 1;
            } else {
                factor = 0;
            }

            if (this[pu].number[i][3]) {
                let dir = this[pu].number[i][3];
                let angle = 0;
                switch (dir) {
                    case 'UR':
                        angle = -Math.PI / 4;
                        break;
                    case 'U':
                        angle = -Math.PI / 2;
                        break;
                    case 'UL':
                        angle = -Math.PI * 3 / 4;
                        break;
                    case 'L':
                        angle = Math.PI;
                        break;
                    case 'DL':
                        angle = Math.PI * 3 / 4;
                        break;
                    case 'D':
                        angle = Math.PI / 2;
                        break;
                    case 'DR':
                        angle = Math.PI / 4;
                        break;
                }
                this.ctx.save();
                this.ctx.translate(p_x, p_y);
                this.ctx.rotate(angle);
                this.ctx.translate(-p_x, -p_y);

                // TODO: only rotate the number in arrow mode, not the arrow
            }

            switch (this[pu].number[i][2]) {
                case "1": //normal
                    set_font_style(this.ctx, 0.7 * this.size.toString(10), this[pu].number[i][1]);

                    // if some numbers present in the corner (like Killer sudoku etc) then displace the numbers slightly lower to avoid overlap
                    let offset = UserSettings.sudoku_normal_bottom ? 0.16 : 0.06;
                    this.ctx.text(this[pu].number[i][0], p_x, p_y + offset * factor * this.size, this.size * 0.8);

                    break;
                case "2": //arrow
                    var arrowlength = 0.7;
                    set_font_style(this.ctx, 0.7 * this.size.toString(10), this[pu].number[i][1]);
                    var direction = {
                        "_0": 90,
                        "_1": 180,
                        "_2": 0,
                        "_3": 270,
                        "_4": 135,
                        "_5": 45,
                        "_6": 225,
                        "_7": 315,
                    }
                    var direction = (direction[this[pu].number[i][0].slice(-2)] - this.theta + 360) % 360;
                    if (this.reflect[0] === -1) {
                        direction = (180 - direction + 360) % 360;
                    }
                    if (this.reflect[1] === -1) {
                        direction = (360 - direction + 360) % 360;
                    }
                    switch (direction) {

                        case 180:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x + 0.0 * this.size, p_y + 0.15 * this.size, this.size * 0.8);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (arrowlength * 0.5 + 0.0) * this.size, p_y + (arrowlength * 0.0 - 0.3) * this.size,
                                p_x + (-arrowlength * 0.5 + 0.0) * this.size, p_y + (-arrowlength * 0.0 - 0.3) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 0:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x + 0.0 * this.size, p_y + 0.15 * this.size, this.size * 0.8);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x - (arrowlength * 0.5 + 0.0) * this.size, p_y + (arrowlength * 0.0 - 0.3) * this.size,
                                p_x - (-arrowlength * 0.5 + 0.0) * this.size, p_y + (-arrowlength * 0.0 - 0.3) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 90:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x - 0.1 * this.size, p_y + 0.05 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (arrowlength * 0.0 + 0.3) * this.size, p_y + (arrowlength * 0.5 - 0.0) * this.size,
                                p_x + (-arrowlength * 0.0 + 0.3) * this.size, p_y + (-arrowlength * 0.5 - 0.0) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 270:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x - 0.1 * this.size, p_y + 0.05 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (arrowlength * 0.0 + 0.3) * this.size, p_y + (-arrowlength * 0.5 - 0.0) * this.size,
                                p_x + (-arrowlength * 0.0 + 0.3) * this.size, p_y + (arrowlength * 0.5 - 0.0) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 45:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x + 0.05 * this.size, p_y + 0.15 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (-arrowlength * 0.35 - 0.2) * this.size, p_y + (arrowlength * 0.35 - 0.2) * this.size,
                                p_x + (arrowlength * 0.35 - 0.2) * this.size, p_y + (-arrowlength * 0.35 - 0.2) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 225:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x + 0.05 * this.size, p_y + 0.15 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (arrowlength * 0.35 - 0.2) * this.size, p_y + (-arrowlength * 0.35 - 0.2) * this.size,
                                p_x + (-arrowlength * 0.35 - 0.2) * this.size, p_y + (arrowlength * 0.35 - 0.2) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 135:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x - 0.05 * this.size, p_y + 0.15 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (arrowlength * 0.35 + 0.2) * this.size, p_y + (arrowlength * 0.35 - 0.2) * this.size,
                                p_x + (-arrowlength * 0.35 + 0.2) * this.size, p_y + (-arrowlength * 0.35 - 0.2) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        case 315:
                            this.ctx.text(this[pu].number[i][0].slice(0, -2), p_x - 0.05 * this.size, p_y + 0.15 * this.size, this.size * 0.7);
                            this.ctx.beginPath();
                            this.ctx.arrow(p_x + (-arrowlength * 0.35 + 0.2) * this.size, p_y + (-arrowlength * 0.35 - 0.2) * this.size,
                                p_x + (arrowlength * 0.35 + 0.2) * this.size, p_y + (arrowlength * 0.35 - 0.2) * this.size,
                                [0, 1, -0.25 * this.size, 1, -0.25 * this.size, 3]);
                            this.ctx.stroke();
                            this.ctx.fill();
                            break;
                        default:
                            set_font_style(this.ctx, 0.7 * this.size.toString(10), this[pu].number[i][1]);
                            ;
                            this.ctx.text(this[pu].number[i][0], p_x, p_y + 0.06 * this.size, this.size * 0.8);
                            break;
                    }
                    break;
                case "4": //tapa
                    let values = [...this[pu].number[i][0]]; // This is to handle unicode symbols.

                    // If the clue is quad (like in a sudoku) render it differently
                    // Conditions - Clue is on the corner (type 1), style is with background circle
                    let quad = (this.types[1].indexOf(this.point[i].type) !== -1) && [5, 6, 7, 11].includes(this[pu].number[i][1]) && this.version_ge(3, 1, 2);
                    if (quad) {
                        set_font_style(this.ctx, 0.31 * this.size.toString(10), this[pu].number[i][1]);
                        if (values.length === 1) {
                            this.ctx.text(values[0], p_x, p_y + 0.00 * this.size, this.size * 0.6);
                        } else if (values.length === 2) {
                            this.ctx.text(values[0], p_x - 0.10 * this.size, p_y - 0.00 * this.size, this.size * 0.6);
                            this.ctx.text(values[1], p_x + 0.10 * this.size, p_y + 0.00 * this.size, this.size * 0.6);
                        } else if (values.length === 3) {
                            this.ctx.text(values[0], p_x - 0.10 * this.size, p_y - 0.10 * this.size, this.size * 0.6);
                            this.ctx.text(values[1], p_x + 0.10 * this.size, p_y - 0.10 * this.size, this.size * 0.6);
                            this.ctx.text(values[2], p_x - 0.00 * this.size, p_y + 0.15 * this.size, this.size * 0.6);
                        } else if (values.length === 4) {
                            this.ctx.text(values[0], p_x - 0.10 * this.size, p_y - 0.10 * this.size, this.size * 0.6);
                            this.ctx.text(values[1], p_x + 0.10 * this.size, p_y - 0.10 * this.size, this.size * 0.6);
                            this.ctx.text(values[2], p_x - 0.10 * this.size, p_y + 0.15 * this.size, this.size * 0.6);
                            this.ctx.text(values[3], p_x + 0.10 * this.size, p_y + 0.15 * this.size, this.size * 0.6);
                        }
                    } else {
                        if (values.length === 1) {
                            set_font_style(this.ctx, 0.7 * this.size.toString(10), this[pu].number[i][1]);
                            this.ctx.text(values[0], p_x, p_y + 0.06 * this.size, this.size * 0.8);
                        } else if (values.length === 2) {
                            set_font_style(this.ctx, 0.48 * this.size.toString(10), this[pu].number[i][1]);
                            this.ctx.text(values[0], p_x - 0.16 * this.size, p_y - 0.15 * this.size, this.size * 0.8);
                            this.ctx.text(values[1], p_x + 0.18 * this.size, p_y + 0.19 * this.size, this.size * 0.8);
                        } else if (values.length === 3) {
                            set_font_style(this.ctx, 0.45 * this.size.toString(10), this[pu].number[i][1]);
                            this.ctx.text(values[0], p_x - 0.22 * this.size, p_y - 0.14 * this.size, this.size * 0.8);
                            this.ctx.text(values[1], p_x + 0.24 * this.size, p_y - 0.05 * this.size, this.size * 0.8);
                            this.ctx.text(values[2], p_x - 0.0 * this.size, p_y + 0.3 * this.size, this.size * 0.8);
                        } else if (values.length === 4) {
                            set_font_style(this.ctx, 0.4 * this.size.toString(10), this[pu].number[i][1]);
                            this.ctx.text(values[0], p_x - 0.0 * this.size, p_y - 0.22 * this.size, this.size * 0.8);
                            this.ctx.text(values[1], p_x - 0.26 * this.size, p_y + 0.04 * this.size, this.size * 0.8);
                            this.ctx.text(values[2], p_x + 0.26 * this.size, p_y + 0.04 * this.size, this.size * 0.8);
                            this.ctx.text(values[3], p_x - 0.0 * this.size, p_y + 0.3 * this.size, this.size * 0.8);
                        }
                    }
                    break;
                case "5": //small
                case "6": //medium
                case "10": //big
                    if (this[pu].number[i][0]) {
                        // Calculate layout parameters based on size

                        var fontSize = this.size;
                        if (this[pu].number[i][2] == "5")
                            fontSize *= 0.25;
                        else if (this[pu].number[i][2] == "6")
                            fontSize *= 0.4;
                        else
                            fontSize *= 0.6;

                        var dy = 0.03;
                        if (this[pu].number[i][2] == "5")
                            dy = 0.02;

                        var maxWidth = this.size;
                        if (this[pu].number[i][2] == "10")
                            maxWidth *= 0.8;
                        else
                            maxWidth *= 0.9;

                        // Fast path, no conflict checking, just draw it all at once
                        if (!UserSettings.check_pencil_marks) {
                            set_font_style(this.ctx, fontSize, this[pu].number[i][1]);
                            this.ctx.text(this[pu].number[i][0], p_x, p_y + dy * factor * this.size, maxWidth);
                        }
                            // Slow path: have to draw the digits one by one so we can change
                        // colors on them individually
                        else {
                            // Calculate text width to see if the font needs to be shrunk
                            set_font_style(this.ctx, fontSize, this[pu].number[i][1]);
                            var width = this.ctx.measureText(this[pu].number[i][0]).width;
                            if (width > maxWidth) {
                                fontSize = maxWidth / width * fontSize;
                                width = maxWidth;
                                set_font_style(this.ctx, fontSize, this[pu].number[i][1]);
                            }

                            // Left align since we're drawing each digit separately
                            var align = this.ctx.textAlign;
                            this.ctx.textAlign = "left";

                            var dx = -width / 2;
                            // Draw each individual digit
                            for (var j in this[pu].number[i][0]) {
                                var text = this[pu].number[i][0].charAt(j);
                                var n = parseInt(text);
                                n = Number.isNaN(n) ? text : n;
                                var style = this.ctx.fillStyle;
                                if (this.conflict_cell_values[i] && this.conflict_cell_values[i].includes(n))
                                    this.ctx.fillStyle = Color.RED;

                                // Draw the digit and add its width to the horizontal offset
                                this.ctx.text(text, p_x + dx, p_y + dy * factor * this.size, maxWidth);
                                dx += this.ctx.measureText(text).width;

                                this.ctx.fillStyle = style;
                            }
                            this.ctx.textAlign = align;
                        }
                    }
                    break;
                case "7": //sudoku
                    var sum = 0,
                        pos = 0;
                    for (var j = 0; j < 9; j++) {
                        if (this[pu].number[i][0][j] === 1) {
                            sum += 1;
                            pos = j;
                        }
                    }
                    if (sum === 1) {
                        set_font_style(this.ctx, 0.7 * this.size.toString(10), this[pu].number[i][1]);
                        this.ctx.text((pos + 1).toString(), p_x, p_y + 0.06 * this.size, this.size * 0.8);
                    } else {
                        set_font_style(this.ctx, 0.3 * this.size.toString(10), this[pu].number[i][1]);
                        for (var j = 0; j < 9; j++) {
                            if (this[pu].number[i][0][j] === 1) {
                                var style = this.ctx.fillStyle;
                                if (this.conflict_cell_values[i] && this.conflict_cell_values[i].includes(j + 1))
                                    this.ctx.fillStyle = Color.RED;
                                this.ctx.text((j + 1).toString(), p_x + ((j % 3 - 1) * 0.28) * this.size, p_y + (((j / 3 | 0) - 1) * 0.28 + 0.02) * this.size);
                                this.ctx.fillStyle = style;
                            }
                        }
                    }
                    break;
                case "8": //long
                {
                    let number_data = this[pu].number[i];
                    let lines = number_data[0].split('\n');
                    for (let line of lines) {
                        if (number_data[1] === 5) {
                            set_font_style(this.ctx, 0.5 * this.size.toString(10), number_data[1]);
                            set_circle_style(this.ctx, 7);
                            this.ctx.fillRect(p_x - 0.2 * this.size, p_y - 0.25 * this.size, this.ctx.measureText(line).width, 0.5 * this.size);
                        }
                        set_font_style(this.ctx, 0.5 * this.size.toString(10), number_data[1]);
                        this.ctx.textAlign = "left";
                        this.ctx.text(line, p_x - 0.2 * this.size, p_y);
                        p_y += this.size * 0.5;
                    }
                }
                    break;
            }

            if (this[pu].number[i][3]) {
                this.ctx.restore();
            }
        }

        for (var i in this[pu].numberS) {
            if (this[pu].numberS[i][1] === 5) {
                set_circle_style(this.ctx, 7);
                this.draw_polygon(this.ctx, this.point[i].x, this.point[i].y, 0.27, 4, 45);
            } else if (this[pu].numberS[i][1] === 6) {
                set_circle_style(this.ctx, 1);
                this.draw_circle(this.ctx, this.point[i].x, this.point[i].y, 0.18);
            } else if (this[pu].numberS[i][1] === 7) {
                set_circle_style(this.ctx, 2);
                this.draw_circle(this.ctx, this.point[i].x, this.point[i].y, 0.18);
            } else if (this[pu].numberS[i][1] === 11) {
                set_circle_style(this.ctx, 11);
                this.draw_circle(this.ctx, this.point[i].x, this.point[i].y, 0.18);
            }
            if (true) { //(this[pu].numberS[i][0].length <= 2 ){
                if (this.point[i]) {

                    if (this[pu].numberS[i][2]) {
                        let dir = this[pu].numberS[i][2];
                        let angle = 0;
                        switch (dir) {
                            case 'UR':
                                angle = -Math.PI / 4;
                                break;
                            case 'U':
                                angle = -Math.PI / 2;
                                break;
                            case 'UL':
                                angle = -Math.PI * 3 / 4;
                                break;
                            case 'L':
                                angle = Math.PI;
                                break;
                            case 'DL':
                                angle = Math.PI * 3 / 4;
                                break;
                            case 'D':
                                angle = Math.PI / 2;
                                break;
                            case 'DR':
                                angle = Math.PI / 4;
                                break;
                        }
                        this.ctx.save();
                        this.ctx.translate(this.point[i].x, this.point[i].y);
                        this.ctx.rotate(angle);
                        this.ctx.translate(-this.point[i].x, -this.point[i].y);
                    }

                    var [_, _, j] = this.point[i].index;
                    set_font_style(this.ctx, 0.32 * this.size.toString(10), this[pu].numberS[i][1]);
                    var n = parseInt(this[pu].numberS[i][0]);
                    var style = this.ctx.fillStyle;
                    if (UserSettings.check_pencil_marks && this.conflict_cell_values[j] &&
                        this.conflict_cell_values[j].includes(n))
                        this.ctx.fillStyle = Color.RED;
                    this.ctx.textAlign = "center";
                    this.ctx.text(this[pu].numberS[i][0], this.point[i].x, this.point[i].y + 0.03 * this.size, this.size * 0.48);
                    this.ctx.fillStyle = style;

                    if (this[pu].numberS[i][2]) {
                        this.ctx.restore();
                    }
                }
                //}else{
                //  set_font_style(this.ctx,0.28*this.size.toString(10),this[pu].numberS[i][1]);
                //  this.ctx.textAlign = "left";
                //  this.ctx.text(this[pu].numberS[i][0],this.point[i].x-0.15*this.size,this.point[i].y+0.03*this.size,this.size*0.8);
            }
        }
    }

    draw_number_circle(pu) {
        var p_x, p_y;
        for (var i in this[pu].number) {
            if (i.slice(-1) === "E") { // Overwriting in Edge Mode
                p_x = this.point[i.slice(0, -1)].x;
                p_y = this.point[i.slice(0, -1)].y;
            } else {
                p_x = this.point[i].x;
                p_y = this.point[i].y;
            }
            switch (this[pu].number[i][2]) {
                case "1": //normal
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.42);
                    break;
                case "2": //arrow
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.42);
                    break;
                case "4": //tapa
                    let quad = (this.types[1].indexOf(this.point[i].type) !== -1) && [5, 6, 7, 11].includes(this[pu].number[i][1]) && this.version_ge(3, 1, 2);
                    this.draw_numbercircle(pu, i, p_x, p_y, quad ? 0.31 : 0.44);
                    break;
                case "5": //small
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.17);
                    break;
                case "6": //medium
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.25);
                    break;
                case "10": //big
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.36);
                    break;
                case "7": //sudoku
                    this.draw_numbercircle(pu, i, p_x, p_y, 0.42);
                    break;
            }
        }
    }

    draw_numbercircle(pu, i, p_x, p_y, size) {
        if (this[pu].number[i][1] === 5) {
            set_circle_style(this.ctx, 7);
            this.draw_circle(this.ctx, p_x, p_y, size);
        } else if (this[pu].number[i][1] === 6) {
            set_circle_style(this.ctx, 1);
            this.draw_circle(this.ctx, p_x, p_y, size);
        } else if (this[pu].number[i][1] === 7) {
            set_circle_style(this.ctx, 2);
            this.draw_circle(this.ctx, p_x, p_y, size);
        } else if (this[pu].number[i][1] === 11) {
            set_circle_style(this.ctx, 11);
            this.draw_circle(this.ctx, p_x, p_y, size);
        }
    }

}
globalThis.PenpaClueReference = PenpaClueReference;
