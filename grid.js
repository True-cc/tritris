class Grid {
    constructor(width, height) {
        this.w = width;
        this.h = height;
        /** @type {GridCell[][]]} */
        this.grid = [];
        for (let i = 0; i < this.h; i++) {
            this.grid.push([]);
            for (let j = 0; j < this.w; j++) {
                this.grid[i].push(new GridCell());
            }
        }
    }

    clearLines() {
        let linesCleared = [];
        for (let row = 0; row < this.h; row++) {
            let full = true;
            for (let col = 0; col < this.w; col++) {
                if (!this.grid[row][col].isFull()) {
                    full = false;
                    break;
                }
            }
            if (full) {
                linesCleared.push(row);
            }
        }
        return linesCleared;
    }

    removeRightTri(row, col) {
        if (col < 0 || col >= this.w) return;
        this.grid[row][col].removeRightTri();
    }

    removeLeftTri(row, col) {
        if (col < 0 || col >= this.w) return;
        this.grid[row][col].removeLeftTri();
    }

    removeLine(row) {
        this.grid.splice(row, 1); //Remove the row
        this.grid.unshift([]); //Add a new row at the top
        for (let col = 0; col < this.w; col++) this.grid[0].push(new GridCell());
    }

    addPiece(piece) {
        for (let row = 0; row < piece.grid.length; row++) {
            for (let col = 0; col < piece.grid[0].length; col++) {
                let gridRow = row + piece.pos.y;
                let gridCol = col + piece.pos.x;
                this.grid[gridRow][gridCol].addCell(piece.grid[row][col]);
            }
        }
    }

    isValid(piece) {
        for (let row = 0; row < piece.grid.length; row++) {
            for (let col = 0; col < piece.grid[0].length; col++) {
                let gridRow = row + piece.pos.y;
                let gridCol = col + piece.pos.x;
                if (
                    this.grid[gridRow][gridCol].collides(piece.grid[row][col])
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    show(x, y, w, h, colors, paused, showGridLines) {
        const cellW = w / this.w;
        const cellH = h / this.h;

        if (!paused) {
            //Draws the triangles in the grid
            for (let i = 0; i < this.h; i++) {
                for (let j = 0; j < this.w; j++) {
                    this.grid[i][j].show(
                        x + j * cellW,
                        y + i * cellH,
                        cellW,
                        cellH,
                        colors
                    );
                }
            }
        }

        if (showGridLines) {
            //Draws the grid outline
            stroke(100);
            strokeWeight(2);
            //Vertical lines
            for (let i = 0; i <= this.w; i++)
                line(x + i * cellW, y, x + i * cellW, y + h);
            //Horizontal lines
            for (let j = 0; j <= this.h; j++)
                line(x, y + j * cellH, x + w, y + j * cellH);
        }
    }

    /**
     * @return {Grid}
     */
    copy() {
        let newGrid = new Grid(this.w, this.h);
        for (let i = 0; i < this.h; i++) {
            for (let j = 0; j < this.w; j++) {
                newGrid.grid[i][j] = this.grid[i][j].copy();
            }
        }
        return newGrid;
    }

    /**
     * @return {GridCell}
     */
    getCellFromMousePos(mouseX, mouseY, x, y, w, h) {
        let gY = (mouseX - x)/w*this.w;
        let gX = (mouseY - y)/h*this.h;
        return this.grid[parseInt(gX)][parseInt(gY)];
    }
}

class GridCell {
    constructor(triangles, clr) {
        this.customShape = -1;
        if (triangles == undefined) {
            this.tris = [
                [null, null],
                [null, null],
            ];
        } else {
            this.tris = [];
            for (let row = 0; row < 2; row++) {
                this.tris.push([]);
                for (let col = 0; col < 2; col++) {
                    if (triangles[row][col] == 1) {
                        this.tris[row][col] = new Triangle(clr);
                    } else {
                        this.tris[row][col] = null;
                    }
                }
            }
        }
    }

    removeRightTri() {
        this.tris[0][1] = null;
        this.tris[1][1] = null;
        this.customShape = -1;
    }

    removeLeftTri() {
        this.tris[0][0] = null;
        this.tris[1][0] = null;
        this.customShape = -1;
    }

    isFull() {
        return (this.tris[0][0] !== null && this.tris[1][1] !== null) ||
            (this.tris[1][0] !== null && this.tris[0][1] !== null);
    }

    rotatedLeft() {
        let rotated = new GridCell();
        rotated.tris = [
            [this.tris[0][1], this.tris[1][1]],
            [this.tris[0][0], this.tris[1][0]],
        ];
        return rotated;
    }

    rotatedRight() {
        let rotated = new GridCell();
        rotated.tris = [
            [this.tris[1][0], this.tris[0][0]],
            [this.tris[1][1], this.tris[0][1]],
        ];
        return rotated;
    }

    addCell(cell) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (cell.tris[row][col])
                    this.tris[row][col] = cell.tris[row][col];
            }
        }
        this.customShape = -1;
    }

    collides(other) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (!this.tris[row][col]) continue;
                if (
                    other.tris[row][col] ||
                    other.tris[(row + 1) % 2][col] ||
                    other.tris[row][(col + 1) % 2]
                )
                    return true; //There is a collision
            }
        }
        return false;
    }

    show(x, y, w, h, colors) {
        // if (this.selected) {
        //     fill(color(100, 100, 255));
        //     rect(x, y, w, h)
        // }
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (this.tris[row][col])
                    this.tris[row][col].show(x, y, w, h, row, col, colors);
            }
        }
    }

    nextCustomShape() {
        this.customShape++;
        if (this.customShape >= 6) this.customShape = 0;
        this.setCustomShape();
    }

    prevCustomShape() {
        if (this.customShape == -1) this.customShape = 5;
        this.customShape--;
        if (this.customShape <= -1) this.customShape = 5;
        this.setCustomShape();
    }

    setCustomShape() { // shit lazy arse shit but idc it works
        switch (this.customShape) {
            case 0: {
                this.tris = [
                    [null, null],
                    [null, new Triangle(6)],
                ];
                break;
            }
            case 1: {
                this.tris = [
                    [null, null],
                    [new Triangle(6), null],
                ];
                break;
            }
            case 2: {
                this.tris = [
                    [new Triangle(6), null],
                    [null, null],
                ];
                break;
            }
            case 3: {
                this.tris = [
                    [null, new Triangle(6)],
                    [null, null],
                ];
                break;
            }
            case 4: {
                this.tris = [
                    [null, new Triangle(6)],
                    [new Triangle(6), null],
                ];
                break;
            }
            case 5: {
                this.tris = [
                    [null, null],
                    [null, null],
                ];
                break;
            }
        }
    }

    /**
     * @return {GridCell}
     */
    copy() {
        let gridCell = new GridCell(undefined, 0);
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                let tris = this.tris[row][col];
                if (tris == null) continue;
                gridCell.tris[row][col] = tris.copy();
            }
        }
        return gridCell;
    }
}

class Triangle {
    constructor(clr) {
        this.clr = clr;
    }

    show(x, y, w, h, row, col, colors) {
        stroke(100);
        strokeWeight(2);
        fill(colors[this.clr]);
        if (row == 0 && col == 0) {
            triangle(x, y, x + w, y, x, y + h);
        } else if (row == 0 && col == 1) {
            triangle(x, y, x + w, y, x + w, y + h);
        } else if (row == 1 && col == 0) {
            triangle(x, y, x, y + h, x + w, y + h);
        } else if (row == 1 && col == 1) {
            triangle(x, y + h, x + w, y, x + w, y + h);
        }
    }

    /**
     * @return {Triangle}
     */
    copy() {
        return new Triangle(this.clr);
    }
}


/////////////// PROBABLY SHOULDN'T PUT THIS HERE \\\\\\\\\\\\\\\

addEventListener('click', onclick)

/**
 * lol I never use JS xD
 * @param {MouseEvent} event 
 */
function onclick(event) {
    let gameWidth = min(width / 2, height / 2) - 2 * padding;
    let gameHeight = gameWidth * (game.h / game.w);
    if (gameHeight > height) {
        gameHeight = height - 2 * padding;
        gameWidth = gameHeight * (game.w / game.h);
    }
    const gameX = width / 2 - gameWidth / 2;
    const gameY = height / 2 - gameHeight / 2;
    if (event.clientX >= gameX && event.clientX <= gameX + gameWidth &&
        event.clientY >= gameY && event.clientY <= gameY + gameHeight) {
        if (gameState == 2) {
            let cell = game.grid.getCellFromMousePos(event.clientX, event.clientY, gameX, gameY, gameWidth, gameHeight);
            console.log(cell, event.shiftKey)
            if (cell != null) {
                if (event.shiftKey) cell.prevCustomShape();
                else cell.nextCustomShape();
            }
            game.redraw = true;
        }
    }
}
