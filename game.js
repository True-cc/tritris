gameWidth = 8
gameHeight = 16
gameOptions = {
    AutoSetMap: false,
    PlacePieces: true
}

class Game {
    constructor(piecesJSON, level, practice) {
        this.w = gameWidth;
        this.h = gameHeight;
        game = this;
        this.grid = new Grid(this.w, this.h);

        this.alive = true;

        if (level < 0) level = 0;
        if (level > 29) level = 29;
        if (level >= 20 && level <= 28) level = 19; //Can only start on 0-19 or 29
        this.startLevel = level;
        this.level = level;
        this.lines = 0;
        this.score = 0;
        this.scoreWeights = { 1: 100, 2: 400, 3: 1200 };

        this.practice = practice;
        if (this.practice) {
            for (const lineAmt in this.scoreWeights) {
                this.scoreWeights[lineAmt] = 0; //No points in practice mode
            }
        }

        this.colors = [
            color(255, 0, 0),
            color(0, 255, 0),
            color(255, 255, 0),
            color(255, 0, 255),
            color(0, 255, 255),
            color(250, 100, 25),
            color(255),
        ];
        this.piecesJSON = piecesJSON.pieces;

        const frameRate = 60.0988; //frames per second
        const msPerFrame = 1000 / frameRate;
        this.entryDelays = [
            10 * msPerFrame,
            12 * msPerFrame,
            14 * msPerFrame, //Numbers from https://tetris.wiki/Tetris_(NES,_Nintendo)
            16 * msPerFrame,
            18 * msPerFrame,
        ];

        this.currentPiece = null; //The current piece starts as null
        this.nextPiece = null; //The next piece starts as a random piece that isn't a single triangles
        this.nextPieceIndex = null;
        this.nextSingles = 0;

        /** @type {number[]} */
        this.bag = [];
        overrideNum = -1; // For #0

        this.spawnPiece(); //Sets the next piece
        this.spawnPiece(); //Make next piece current, and pick new next

        this.levelSpeeds = {
            0: 48,
            1: 43, //From https://tetris.wiki/Tetris_(NES,_Nintendo)
            2: 38,
            3: 33,
            4: 28,
            5: 23,
            6: 18,
            7: 13,
            8: 8,
            9: 6,
            10: 5, //Level 10-12
            13: 4, //13 - 15
            16: 3, //16 - 18
            19: 2, //19 - 28
            29: 1, //29+
        };
        for (let lvl of Object.keys(this.levelSpeeds)) {
            this.levelSpeeds[lvl] *= msPerFrame; //Make sure the are in the correct units
        }
        this.pieceSpeed = 0;
        this.setSpeed(); //This will correctly set pieceSpeed depending on which level it's starting on

        this.softDropSpeed = msPerFrame * 2;
        if (this.practice) this.softDropSpeed *= 4;
        this.lastMoveDown = Date.now() + 750;

        this.das = 0;
        this.dasMax = msPerFrame * 16; //It takes 16 frames on an NES to fully charge DAS
        this.dasCharged = msPerFrame * 10; //When charged, DAS reset to 10 frames

        this.lastFrame = Date.now(); //Used to calculate deltaTime and for DAS

        this.entryDelay = msPerFrame * 14; //There is a 10 frame entry delay (the time btwn the last piece locking in, and the next spawning)
        this.spawnNextPiece = 0;

        this.animationTime = 0;
        this.animatingLines = [];
        this.maxAnimationTime = 20 * msPerFrame;
        this.lastColCleared = 0;
        this.maxFlashTime = 20 * msPerFrame;
        this.flashTime = 0;
        this.flashAmount = 4;

        this.tritrisAmt = 0; //For statistics
        this.totalTime = 0;

        this.redraw = true;

        this.downPressedAt = 0; //Used to calculate how many cells a piece traveled when down was pressed
        this.downWasPressed = false;
        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.zWasPressed = false;
        this.zCharged = false;
        this.xWasPressed = false;
        this.xCharged = false;

        this.playClearSound = false;
        this.playFallSound = false;
        this.playMoveSound = false;
        this.playTritrisSound = false;
        resetHist();
        saveHist();

        if (gameOptions.AutoSetMap) {
            importMap(true);
        }
    }

    update() {
        if (!this.alive) return;

        const now = Date.now();
        const deltaTime = now - this.lastFrame;
        this.totalTime += deltaTime;

        //Play a line clear animation
        if (now <= this.animationTime) {
            const percentDone =
                (this.animationTime - now) / this.maxAnimationTime;
            const clearingCol = Math.floor(percentDone * 10);
            for (const row of this.animatingLines) {
                //Clear as many cols as necessary
                for (let col = this.lastColCleared; col >= clearingCol; col--) {
                    //Clear from middle to left (triangle by traingle)
                    const colPos = Math.floor(col / 2);
                    if (col % 2 == 1) this.grid.removeRightTri(row, colPos);
                    else this.grid.removeLeftTri(row, colPos);

                    //Clear from middle to right
                    const otherColPos = this.w - 1 - colPos;
                    if (col % 2 == 0)
                        this.grid.removeRightTri(row, otherColPos);
                    else this.grid.removeLeftTri(row, otherColPos);
                }
            }
            this.lastColCleared = clearingCol; //To ensure lag doesn't cause any to get skipped
            this.redraw = true;
        } else if (this.animatingLines.length > 0) {
            //After a line clear animation has just been completed
            //Readjust the entry delay to accommodate for the animation time
            this.spawnNextPiece += this.maxAnimationTime;
            if (!this.practice) { //No lines or score in practice mode
                this.lines += this.animatingLines.length;

                //Increase the level after a certain amt of lines, then every 10 lines
                let incLevel = false;
                if (this.level == this.startLevel) {
                    //This formula is from https://tetris.wiki/Tetris_(NES,_Nintendo)
                    if (this.lines >= (this.startLevel + 1) * 10 || this.lines >= max(100, this.startLevel * 10 - 50)) {
                        incLevel = true;
                    }
                } else {
                    //If the tens digit increases (Ex from 128 to 131)
                    const prevLineAmt = Math.floor((this.lines - this.animatingLines.length) / 10);
                    const newLineAmt = Math.floor(this.lines / 10);
                    if (newLineAmt > prevLineAmt) incLevel = true;
                }

                if (incLevel) {
                    this.level++;
                    this.setSpeed();
                }
                this.score += this.scoreWeights[this.animatingLines.length] * (this.level + 1);
                if (this.animatingLines.length == 3)
                    this.tritrisAmt++;
            }

            for (const row of this.animatingLines) {
                this.grid.removeLine(row);
            }
            this.animatingLines = [];

            this.redraw = true;
        }

        //Spawn the next piece after entry delay
        if (
            this.currentPiece == null &&
            now > this.spawnNextPiece &&
            now > this.animationTime
        ) {
            this.spawnPiece();
            this.lastMoveDown = now;
            this.redraw = true;
            if (!this.isValid(this.currentPiece)) {
                this.alive = false; //If the new piece is already blocked, game over
            }
            saveHist();
        }

        if (this.currentPiece !== null) {
            //If either left is pressed or right is pressed and down isn't
            let oneKeyPressed = keyIsDown(controls.left) != keyIsDown(controls.right);
            if (!this.practice && keyIsDown(controls.down)) {
                oneKeyPressed = false; //Allows down and left/right to be pressed in practice, but not in a real game
            }
            let move = false;
            if (oneKeyPressed) {
                this.das += deltaTime;
                if (
                    (keyIsDown(controls.left) && !this.leftWasPressed) ||
                    (keyIsDown(controls.right) && !this.rightWasPressed)
                ) {
                    //If it was tapped, move and reset das
                    move = true;
                    this.das = 0;
                } else if (this.das >= this.dasMax) {
                    move = true; //Key is being held, keep moving
                    this.das = this.dasCharged;
                }
            }

            let horzDirection = 0;
            if (move) {
                if (keyIsDown(controls.left)) horzDirection = -1;
                if (keyIsDown(controls.right)) horzDirection = 1;
            }

            const zPressed = keyIsDown(controls.counterClock) && (!this.zWasPressed || this.zCharged);
            const xPressed = keyIsDown(controls.clock) && (!this.xWasPressed || this.xCharged);
            let rotation = 0;
            if (zPressed && xPressed) rotation = 2;
            else if (xPressed) rotation = 1;
            else if (zPressed) rotation = -1;

            let pieceSpeed = this.pieceSpeed;
            if (keyIsDown(controls.down)) {
                //Pressing down moves twice as fast, or as fast as the min
                pieceSpeed = min(pieceSpeed, this.softDropSpeed);
            }
            if (keyIsDown(controls.down) && !this.downWasPressed) {
                this.downPressedAt = this.currentPiece.pos.y; //Save when the piece was first pressed down
            }
            let moveDown = Date.now() >= this.lastMoveDown + pieceSpeed;
            if (this.practice && !keyIsDown(controls.down)) {
                moveDown = false; //Pieces only move down when down is pressed in practice mode
            }
            if (horzDirection != 0 || rotation != 0 || moveDown) {
                this.redraw = true; //A piece has moved, so the game must be redrawn
                const placePiece = this.movePiece(
                    horzDirection,
                    rotation,
                    moveDown
                );
                if (placePiece) {
                    if (keyIsDown(controls.down)) {
                        //If it was pushed down, give 1 point per grid cell
                        if (!this.practice) {
                            this.score += this.currentPiece.pos.y - this.downPressedAt;
                        }
                        this.downPressedAt = 0;
                    }
                    //Place the piece
                    this.placePiece();
                    this.zCharged = false; //After a piece is placed, don't rotate the next piece
                    this.xCharged = false;
                } else {
                    //If the piece was able to just move down, reset the timer
                    if (moveDown) this.lastMoveDown = Date.now();
                }
            }
        }

        this.downWasPressed = keyIsDown(controls.down);
        this.leftWasPressed = keyIsDown(controls.left);
        this.rightWasPressed = keyIsDown(controls.right);
        this.zWasPressed = keyIsDown(controls.counterClock); //If Z was pressed
        this.xWasPressed = keyIsDown(controls.clock); //If X was pressed
        if (!keyIsDown(controls.counterClock)) this.zCharged = false; //If the player is pressing anymore, they no longer want to rotate, so don't charge
        if (!keyIsDown(controls.clock)) this.xCharged = false;
        this.lastFrame = Date.now();
    }

    placePiece() {
        if (gameOptions.PlacePieces) {
            this.grid.addPiece(this.currentPiece);

            //Only clear lines if the next piece is not a triangle, or the next piece is a triangle, but it is a new triplet
            if (this.nextPieceIndex != 0 || this.nextSingles == 2) {
                this.clearLines(); //Clear any complete lines
            }
        }
        const row = this.currentPiece.getBottomRow();
        const entryDelay = this.calcEntryDelay(row);
        this.spawnNextPiece = Date.now() + entryDelay;

        this.currentPiece = null; //There is an entry delay for the next piece
    }

    spawnPiece() {
        if (this.bag.length == []) {
            switch (overrideMode) {
                case 0: // one at a time
                case 1: // randomly from the bag
                case 2: { // set this bag and play as normal
                    this.bag = overrideBag.slice(0)
                    break;
                }
                default:{
                    for (let i = 0; i < this.piecesJSON.length; i++) {
                        this.bag.push(i); //Refill the bag with each piece
                    }
                }
            }
        }
        this.currentPiece = this.nextPiece; //Assign the new current piece
        if (this.nextSingles > 0) {
            this.nextPieceIndex = 0; //This will make it spawn 3 single triangles in a row
            this.nextSingles--;
        } else {
            switch (overrideMode) {
                case 0: { // one at a time
                    overrideNum++;
                    if (overrideNum >= overrideBag.length) overrideNum = 0;
                    this.nextPieceIndex = overrideBag[overrideNum];
                    break;
                }
                case 1: { // randomly from override bag
                    this.nextPieceIndex = overrideBag[Math.floor(Math.random() * overrideBag.length)];
                    break;
                }
                default: {
                    this.nextPieceIndex = this.bag.splice(Math.floor(Math.random() * this.bag.length), 1)[0]; //Pick 1 item and remove it from bag
                }
            }
            if (this.nextPieceIndex == 0) {
                //If it randomly chose to spawn 1 triangle, spawn 2 more
                this.nextSingles = 2;
            }
        }

        this.nextPiece = new Piece(this.piecesJSON[this.nextPieceIndex]);
        this.playFallSound = true;
    }

    clearLines() {
        let linesCleared = this.grid.clearLines();
        if (linesCleared.length > 0) {
            //Set the time for when to stop animating
            this.animationTime = Date.now() + this.maxAnimationTime;
            this.lastColCleared = 0; //Used to ensure all triangles are removed. Starts at 0 to only remove 1 on the first frame
            this.animatingLines = linesCleared; //Which lines are being animated (and cleared)
            if (linesCleared.length == 3) {
                //Tritris!
                this.flashTime = Date.now() + this.maxFlashTime;
                this.playTritrisSound = true;
            } else {
                this.playClearSound = true;
            }
        }
    }

    setSpeed() {
        let lvl = this.level;
        if (this.level > 29) lvl = 29;
        if (this.level < 0) lvl = 0;
        while (true) {
            if (this.levelSpeeds.hasOwnProperty(lvl)) {
                this.pieceSpeed = this.levelSpeeds[lvl];
                break;
            } //Finds the correct range for the level speed
            lvl--;
            if (lvl < 0) {
                //Uh oh, something went wrong
                console.error('Level Speed could not be found!');
                break;
            }
        }
    }

    movePiece(horzDirection, rotation, moveDown) {
        //Apply all transformations
        const vertDirection = moveDown ? 1 : 0;
        this.currentPiece.move(horzDirection, vertDirection);
        if (rotation == -1) this.currentPiece.rotateLeft();
        if (rotation == 1) this.currentPiece.rotateRight();
        if (rotation == 2) this.currentPiece.rotate180();

        //Try with all transformations
        let valid = this.isValid(this.currentPiece);
        if (valid) {
            //The piece (possibly) moved horizontally, rotated and moved down
            if (horzDirection != 0) {
                this.playMoveSound = true;
            }
            if (rotation != 0) {
                this.playMoveSound = true;
                this.zCharged = false;
                this.xCharged = false;
            }
            return false; //Don't place the piece
        }
        //If blocked, undo horz move and maybe wall-charge
        this.currentPiece.move(-horzDirection, 0);
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //If the piece was block when moving horz, then wall charge
            this.das = this.dasMax;
            if (rotation != 0) {
                this.playMoveSound = true;
                this.zCharged = false; //If it was able to move, don't keep rotating
                this.xCharged = false;
            }
            return false;
        }

        //If not valid, undo rotation
        if (rotation == 1) this.currentPiece.rotateLeft();
        if (rotation == -1) this.currentPiece.rotateRight();
        if (rotation == 2) this.currentPiece.rotate180();
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //The piece was blocked by rotating
            if (rotation == 1) this.xCharged = true;
            if (rotation == -1) this.zCharged = true;
            if (rotation == 2) {
                this.xCharged = true;
                this.zCharged = true;
            }
            if (horzDirection != 0) this.das = this.dasMax; //Also charge das if blocked by a rotation/wall
            return false; //Don't place the piece
        }

        //If it reaches here, the piece was blocked by moving down and should be placed
        if (moveDown) this.currentPiece.move(0, -1); //Move the piece back up
        //The extra if statement is incase the pieces are at the top and spawn in other pieces
        return true; //Place the piece
    }

    calcEntryDelay(y) {
        if (y >= 18) return this.entryDelays[0];
        if (y >= 14) return this.entryDelays[1];
        if (y >= 10) return this.entryDelays[2];
        if (y >= 6) return this.entryDelays[3];
        return this.entryDelays[4];
    }

    isValid(piece) {
        if (piece.outOfBounds(this.w, this.h)) return false;
        return this.grid.isValid(piece);
    }

    playSounds(clearSound, fallSound, moveSound, tritrisSound) {
        if (this.playClearSound) {
            clearSound.play();
            this.playClearSound = false;
        }
        if (this.playFallSound) {
            fallSound.play();
            this.playFallSound = false;
        }
        if (this.playMoveSound) {
            moveSound.play();
            this.playMoveSound = false;
        }
        if (this.playTritrisSound) {
            tritrisSound.play();
            this.playTritrisSound = false;
        }
    }

    show(x, y, w, h, paused, showGridLines, showStats) {
        //Play flashing animation
        const flashing = this.flashTime >= Date.now();
        if (!this.redraw && !flashing) return; //If not flashing, only draw when necessary

        if (flashing) {
            const timePassed = this.flashTime - Date.now();
            const interval = Math.floor(this.flashAmount * timePassed / this.maxFlashTime);
            if (interval % 2 == 0) {
                background(150);
            } else {
                background(100);
            }
            this.redraw = true; //If flashing, redraw each frame
        } else {
            background(100);
        }


        noStroke();
        fill(0);
        rect(x, y, w, h);

        const cellW = w / this.w;
        const cellH = h / this.h;

        if (this.currentPiece && !paused) {
            this.currentPiece.show(x, y, cellW, cellH, this.colors);
        }

        this.grid.show(x, y, w, h, this.colors, paused, showGridLines);

        const txtSize = 20;
        textSize(txtSize);
        textAlign(LEFT, TOP);
        const padding = 10;
        const scorePos = createVector(x + w + cellW, y + cellH);
        let scoreDim;

        if (!this.practice) {
            const scoreTxt = `Score ${this.score}`;
            const linesTxt = `Lines  ${this.lines}`;
            const levelTxt = `Level  ${this.level}`;
            const textW = max(
                textWidth(scoreTxt),
                textWidth(linesTxt),
                textWidth(levelTxt),
                4 * cellW
            );
            scoreDim = createVector(
                textW + padding + 10,
                txtSize * 4.5 + padding * 2
            );
            noFill();
            stroke(0);
            strokeWeight(3);
            //The box outline
            rect(scorePos.x, scorePos.y, scoreDim.x, scoreDim.y);
            noStroke();
            fill(0);
            text(scoreTxt, scorePos.x + padding, scorePos.y + padding);
            text(
                linesTxt,
                scorePos.x + padding,
                scorePos.y + padding + 1.75 * txtSize
            );
            text(
                levelTxt,
                scorePos.x + padding,
                scorePos.y + padding + 3.5 * txtSize
            );
        } else {
            //Practice mode text
            const line1 = 'PRACTICE';
            const line2 = 'MODE';
            const textW = max(
                textWidth(line1),
                textWidth(line2),
                4 * cellW
            );
            scoreDim = createVector(
                textW + padding + 10,
                txtSize * 4.5 + padding * 2
            );
            noFill();
            stroke(0);
            strokeWeight(3);
            //The box outline
            rect(scorePos.x, scorePos.y, scoreDim.x, scoreDim.y);
            noStroke();
            fill(0);
            text(line1, scorePos.x + padding, scorePos.y + padding);
            text(
                line2,
                scorePos.x + padding,
                scorePos.y + padding + 1.75 * txtSize
            );
        }

        const nextPiecePos = createVector(
            scorePos.x,
            scorePos.y + scoreDim.y + cellH
        );
        const nextPieceDim = createVector(cellW * 3, cellW * 3);
        noFill();
        stroke(0);
        strokeWeight(3);
        rect(nextPiecePos.x, nextPiecePos.y, nextPieceDim.x, nextPieceDim.y);
        if (!paused && this.nextPiece) {
            this.nextPiece.showAt(
                nextPiecePos.x,
                nextPiecePos.y,
                nextPieceDim.x,
                nextPieceDim.y,
                this.colors
            );
        }

        if (showStats && !this.practice) {
            const statPos = createVector(
                scorePos.x,
                nextPiecePos.y + nextPieceDim.y + cellH
            );

            let tritrisPercent = Math.round(100 * 3*this.tritrisAmt / this.lines);
            if (this.lines == 0) tritrisPercent = '--';
            const tritrisPercentText = `Tri ${tritrisPercent}%`;

            const totalSec = Math.round(this.totalTime / 1000) % 60;
            const totalM = Math.floor(this.totalTime / (1000*60));
            const startLevelText = `Time ${nf(totalM,2)}:${nf(totalSec,2)}`;

            const textW = max(
                textWidth(tritrisPercentText),
                textWidth(startLevelText),
                4 * cellW
            );

            const statDim = createVector(
                textW + padding + 10,
                txtSize * 2.75 + padding * 2
            );
            noFill();
            stroke(0);
            strokeWeight(3);
            //The box outline
            rect(statPos.x, statPos.y, statDim.x, statDim.y);
            noStroke();
            fill(0);
            text(tritrisPercentText, statPos.x + padding, statPos.y + padding);
            text(
                startLevelText,
                statPos.x + padding,
                statPos.y + padding + 1.75 * txtSize
            );
        }

        if (this.practice) {
            stroke(255,0,0);
            strokeWeight(4);
            noFill();
            rect(x, y, w, h);
        }

        if (!flashing) this.redraw = false;
    }
}

function setNext() {
    let v = select('#piece').value()
    game.nextPiece = new Piece(game.piecesJSON[v]);
    game.redraw = true;
}


function setCurrent() {
    let v = select('#piece').value()
    game.currentPiece = new Piece(game.piecesJSON[v]);
    game.redraw = true;
    if (v == 0) {
        game.nextSingles = 2;
        game.nextPiece = new Piece(game.piecesJSON[0]);
    } else {
        game.nextSingles = 0;
    }
}

let maps = [];

function saveMap() {
    let v = select('#map').value()
    maps[v] = game.grid.copy()
}

function loadMap() {
    let v = select('#map').value()
    game.grid = maps[v].copy();
    game.redraw = true;
}

function exportMap() {
    let v = document.getElementById('export')
    v.value = game.grid.export()
}

/** @type {number[]} */
overrideBag = [];
// -1 disable, 0 in order, 1 random don't copy, 2 random copy
overrideMode = -1;
overrideNum = -1; // For #0

function importMap(mapOnly) {
    let v = document.getElementById('export')
    if (v.value.length == 0) {
        overrideMode = -1;
        overrideNum = -1;
        gameOptions.AutoSetMap = false;
        gameOptions.PlacePieces = true;
        g = new Grid(8, 16);
        gameWidth = g.w;
        gameHeight = g.h;
        game.w = g.w;
        game.h = g.h;
        game.grid = g;
        game.redraw = true;
        return;
    }
    try {
        let g = importNewGrid(v.value);
        if (isNaN(g.w) || isNaN(g.h) || g.grid == []) {
            v.value = "Invalid map."
            return;
        }
        gameWidth = g.w;
        gameHeight = g.h;
        game.w = g.w;
        game.h = g.h;
        game.grid = g;
        game.redraw = true;
        if (mapOnly) return;
        let split = String(v.value).split(":");
        if (split.length > 3) {
            overrideMode = parseInt(split[3][0]);
            overrideNum = -1;
            let bag = split[3].substring(1);
            overrideBag = []
            for (let n of bag) {
                overrideBag.push(parseInt(n));
            }
            if (split.length > 4) {
                gameOptions.AutoSetMap = split[4].length >= 1 && split[4][0] > 0;
                gameOptions.PlacePieces = split[4].length < 2 || split[4][1] > 0;
            } else {
                gameOptions.AutoSetMap = false;
                gameOptions.PlacePieces = true;
            }
        } else {
            overrideMode = -1;
            overrideNum = -1;
            gameOptions.AutoSetMap = false;
            gameOptions.PlacePieces = true;
        }
    } catch (e) {
        v.value = "Invalid map."
    }
}
