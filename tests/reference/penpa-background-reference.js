/*
 * Unmodified Penpa+ background/redraw methods used only as a rendering oracle.
 * Source: docs/js/class_p.js at upstream commit
 * 34e3fe97804e518288870b70d919e7e76ee18b4d (Penpa+ 3.2.4).
 * https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d
 * See PENPA-LICENSE.txt. Other drawing/UI methods are stubbed in adapter.cjs.
 */
class PenpaBackgroundReference {
    draw_bg_image() {
        if (this.bg_image && this.bg_image_canvas) {
            let data = this.bg_image_data;

            // Take the width/height from the given parameters or from the given image if not
            let width = data.width,
                height = data.height;
            if (!width) {
                if (!height) {
                    width = this.bg_image.width;
                    height = this.bg_image.height;
                } else
                    width = (this.bg_image.width / this.bg_image.height) * height;
            } else if (!height)
                height = (this.bg_image.height / this.bg_image.width) * width;

            this.ctx.drawImage(this.bg_image_canvas, data.x, data.y, width, height);
        }
    }

    redraw(svgcall = false, check_sol = true) {
        try {
            this.flushcanvas(svgcall);
            if (!this.bg_image_data.foreground)
                this.draw_bg_image();
            if (check_sol) {
                this.check_solution();
            }
            panel_pu.draw_panel();
            this.draw();
            this.set_redoundocolor();
            if (this.bg_image_data.foreground)
                this.draw_bg_image();
        }
            // don't crash the UI
        catch (err) {
            console.error(err);
        }
    }
}
globalThis.PenpaBackgroundReference = PenpaBackgroundReference;
