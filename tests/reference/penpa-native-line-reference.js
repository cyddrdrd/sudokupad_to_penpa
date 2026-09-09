/*
 * Unmodified Penpa+ line renderer and style function used as a test oracle.
 * Sources: docs/js/class_square.js and docs/js/style.js at upstream commit
 * 34e3fe97804e518288870b70d919e7e76ee18b4d (Penpa+ 3.2.4).
 * https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d
 * See PENPA-LICENSE.txt.
 */
function set_line_style(ctx, type, ccolor = "none") {
    //Initialization
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.lineCap = "square";
    ctx.strokeStyle = Color.BLACK;
    ctx.lineWidth = 2;
    switch (type) {
        case 0:
            ctx.strokeStyle = Color.TRANSPARENTWHITE;
            ctx.lineWidth = 0;
            break;
        case 1: //grid
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 0.8;
            break;
        case 2:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 3;
            break;
        case 21:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 5;
            break;
        case 3:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.GREEN;
            ctx.lineWidth = 3;
            break;
        case 4:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 2;
            break;
        case 5:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.GREY;
            ctx.lineWidth = 3;
            break;
        case 6:
            ctx.strokeStyle = Color.GREY;
            ctx.lineWidth = 12;
            break;
        case 7: // cage
        case 107:
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.GREY_DARK;
            ctx.lineWidth = 1;
            break;
        case 8:
            ctx.strokeStyle = Color.RED;
            ctx.lineWidth = 3;
            break;
        case 9:
            ctx.strokeStyle = Color.BLUE_LIGHT;
            ctx.lineWidth = 3;
            break;
        case 10: //cage
            var b = pu.size * 0.1;
            var w = pu.size * 0.1;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 1;
            break;
        case 110: //cage
            var b = pu.size * 0.08;
            var w = pu.size * 0.1;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.lineCap = "round";
            if (ccolor !== "none") {
                ctx.strokeStyle = ccolor;
            } else {
                ctx.strokeStyle = Color.BLACK;
            }
            ctx.lineWidth = 1;
            break;
        case 11: //grid dash
            var b = pu.size * 0.06;
            var w = pu.size * 0.14;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 1;
            break;
        case 12: //dash line
            var b = pu.size * 0.06;
            var w = pu.size * 0.14;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.strokeStyle = Color.GREY_DARK_VERY;
            ctx.lineWidth = 1;
            break;
        case 13: //bold dash
            var b = pu.size * 0.04;
            var w = pu.size * 0.21;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = (pu.size * 0.1) | 0;
            break;
        case 14: //dash
            var b = pu.size * 0.11;
            var w = pu.size * 0.14;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.strokeStyle = Color.GREY_DARK;
            ctx.lineWidth = 2;
            break;
        case 15: //cage dash
            var b = pu.size * 0.1;
            var w = pu.size * 0.1;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.lineCap = "round";
            if (ccolor !== "none") {
                ctx.strokeStyle = ccolor;
            } else {
                ctx.strokeStyle = Color.GREY_DARK;
            }
            ctx.lineWidth = 1;
            break;
        case 115: //cage dash
            var b = pu.size * 0.08;
            var w = pu.size * 0.1;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.lineCap = "round";
            if (ccolor !== "none") {
                ctx.strokeStyle = ccolor;
            } else {
                ctx.strokeStyle = Color.GREY_DARK;
            }
            ctx.lineWidth = 1;
            break;
        case 16: // cage
        case 116:
            ctx.lineCap = "round";
            if (ccolor !== "none") {
                ctx.strokeStyle = ccolor;
            } else {
                ctx.strokeStyle = Color.BLACK;
            }
            ctx.lineWidth = 1;
            break;
        case 17: //bold dash for wall
            var b = pu.size * 0.12;
            var w = pu.size * 0.13;
            ctx.setLineDash([b, w]);
            ctx.lineDashOffset = b * 0.5;
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = (pu.size * 0.1) | 0;
            break;
        case 20:
            ctx.strokeStyle = Color.WHITE;
            ctx.lineWidth = 1;
            break;
        case 30: //double line
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.GREEN;
            ctx.lineWidth = 3;
            break;
        case 40: //short line
            ctx.strokeStyle = Color.GREY;
            ctx.lineWidth = 2;
            break;
        case 80: //grid-like line
            ctx.lineCap = "round";
            ctx.strokeStyle = Color.BLACK;
            ctx.lineWidth = 1;
            break;
        case 98: //x-mark
            ctx.strokeStyle = Color.GREEN;
            ctx.lineWidth = 1;
            break;
        case 99: //cursor
            ctx.strokeStyle = Color.RED;
            ctx.lineWidth = 2;
            break;
        case 100: //cursor_panel
            ctx.strokeStyle = Color.RED;
            ctx.lineWidth = 2.5;
            break;
        case 101: // Sudoku cursor
            ctx.strokeStyle = Color.RED_TRANSPARENT;
            ctx.lineWidth = 2;
            break;
    }
}

class PenpaNativeLineReference {
    draw_line(pu) {
        for (var i in this[pu].line) {
            if (this[pu].line[i] === 98) {
                var r = 0.2;
                var x = this.point[i].x;
                var y = this.point[i].y;
                set_line_style(this.ctx, 98);
                if (UserSettings.custom_colors_on && this[pu + "_col"].line[i]) {
                    this.ctx.strokeStyle = this[pu + "_col"].line[i];
                }
                this.ctx.beginPath();
                this.ctx.moveTo(x + r * Math.cos(45 * (Math.PI / 180)) * this.size, y + r * Math.sin(45 * (Math.PI / 180)) * this.size);
                this.ctx.lineTo(x + r * Math.cos(225 * (Math.PI / 180)) * this.size, y + r * Math.sin(225 * (Math.PI / 180)) * this.size);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(x + r * Math.cos(135 * (Math.PI / 180)) * this.size, y + r * Math.sin(135 * (Math.PI / 180)) * this.size);
                this.ctx.lineTo(x + r * Math.cos(315 * (Math.PI / 180)) * this.size, y + r * Math.sin(315 * (Math.PI / 180)) * this.size);
                this.ctx.stroke();
            } else {
                set_line_style(this.ctx, this[pu].line[i]);
                if (UserSettings.custom_colors_on && this[pu + "_col"].line[i]) {
                    this.ctx.strokeStyle = this[pu + "_col"].line[i];
                }
                var i1 = i.split(",")[0];
                var i2 = i.split(",")[1];
                this.ctx.beginPath();
                if (this[pu].line[i] === 40) {
                    var r = 0.8;
                    var x1 = r * this.point[i1].x + (1 - r) * this.point[i2].x;
                    var y1 = r * this.point[i1].y + (1 - r) * this.point[i2].y;
                    var x2 = (1 - r) * this.point[i1].x + r * this.point[i2].x;
                    var y2 = (1 - r) * this.point[i1].y + r * this.point[i2].y;
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                } else if (this[pu].line[i] === 30) {
                    var r = 0.15 * this.size;
                    var dx = this.point[i1].x - this.point[i2].x;
                    var dy = this.point[i1].y - this.point[i2].y;
                    var d = Math.sqrt(dx ** 2 + dy ** 2);
                    this.ctx.moveTo(this.point[i1].x - r / d * dy, this.point[i1].y + r / d * dx);
                    this.ctx.lineTo(this.point[i2].x - r / d * dy, this.point[i2].y + r / d * dx);
                    this.ctx.stroke();
                    this.ctx.moveTo(this.point[i1].x + r / d * dy, this.point[i1].y - r / d * dx);
                    this.ctx.lineTo(this.point[i2].x + r / d * dy, this.point[i2].y - r / d * dx);
                } else {
                    if (this.types[2].indexOf(this.point[i1].type) !== -1) { //for centerline
                        this.ctx.moveTo(this.point[i2].x, this.point[i2].y);
                        this.ctx.lineTo((this.point[i1].x + this.point[i2].x) * 0.5, (this.point[i1].y + this.point[i2].y) * 0.5);
                        this.ctx.stroke();
                        this.ctx.lineCap = "butt";
                    } else if (this.types[2].indexOf(this.point[i2].type) !== -1) {
                        this.ctx.moveTo(this.point[i1].x, this.point[i1].y);
                        this.ctx.lineTo((this.point[i1].x + this.point[i2].x) * 0.5, (this.point[i1].y + this.point[i2].y) * 0.5);
                        this.ctx.stroke();
                        this.ctx.lineCap = "butt";
                    }
                    this.ctx.moveTo(this.point[i1].x, this.point[i1].y);
                    this.ctx.lineTo(this.point[i2].x, this.point[i2].y);
                }
                this.ctx.stroke();
            }
        }
        for (var i in this[pu].lineE) {
            if (this[pu].lineE[i] === 98) {
                var r = 0.2;
                var x = this.point[i].x;
                var y = this.point[i].y;
                set_line_style(this.ctx, 98);
                if (UserSettings.custom_colors_on && this[pu + "_col"].lineE[i]) {
                    this.ctx.strokeStyle = this[pu + "_col"].lineE[i];
                }
                this.ctx.beginPath();
                this.ctx.moveTo(x + r * Math.cos(45 * (Math.PI / 180)) * this.size, y + r * Math.sin(45 * (Math.PI / 180)) * this.size);
                this.ctx.lineTo(x + r * Math.cos(225 * (Math.PI / 180)) * this.size, y + r * Math.sin(225 * (Math.PI / 180)) * this.size);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(x + r * Math.cos(135 * (Math.PI / 180)) * this.size, y + r * Math.sin(135 * (Math.PI / 180)) * this.size);
                this.ctx.lineTo(x + r * Math.cos(315 * (Math.PI / 180)) * this.size, y + r * Math.sin(315 * (Math.PI / 180)) * this.size);
                this.ctx.stroke();
            } else {
                set_line_style(this.ctx, this[pu].lineE[i]);
                if (UserSettings.custom_colors_on && this[pu + "_col"].lineE[i]) {
                    this.ctx.strokeStyle = this[pu + "_col"].lineE[i];
                }
                var i1 = i.split(",")[0];
                var i2 = i.split(",")[1];
                this.ctx.beginPath();
                if (this[pu].lineE[i] === 30) {
                    var r = 0.15 * this.size;
                    var dx = this.point[i1].x - this.point[i2].x;
                    var dy = this.point[i1].y - this.point[i2].y;
                    var d = Math.sqrt(dx ** 2 + dy ** 2);
                    this.ctx.moveTo(this.point[i1].x - r / d * dy, this.point[i1].y + r / d * dx);
                    this.ctx.lineTo(this.point[i2].x - r / d * dy, this.point[i2].y + r / d * dx);
                    this.ctx.stroke();
                    this.ctx.moveTo(this.point[i1].x + r / d * dy, this.point[i1].y - r / d * dx);
                    this.ctx.lineTo(this.point[i2].x + r / d * dy, this.point[i2].y - r / d * dx);
                } else {
                    this.ctx.moveTo(this.point[i1].x, this.point[i1].y);
                    this.ctx.lineTo(this.point[i2].x, this.point[i2].y);
                }
                this.ctx.stroke();
            }
        }
    }


}
globalThis.PenpaNativeLineReference = PenpaNativeLineReference;
