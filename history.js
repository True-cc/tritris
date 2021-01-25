/** @type {GameHistory[]} */
let gameHistory = []

class GameHistory {
    constructor() {
        this.grid = game.grid.copy();
        this.level = game.level;
        this.score = game.score;
        this.currentPiece = game.currentPiece.copy();
        this.nextPiece = game.nextPiece.copy();
        this.nextPieceIndex = game.nextPieceIndex;
        this.nextSingles = game.nextSingles;
        this.bag = game.bag.slice(0);
        this.pieceSpeed = game.pieceSpeed;
    }

    restore() {
        console.log("Restore attempt....?")
        game.grid = this.grid.copy();
        game.level = this.level;
        game.score = this.score;
        game.currentPiece = this.currentPiece.copy();
        game.nextPiece = this.nextPiece.copy();
        game.nextPieceIndex = this.nextPieceIndex;
        game.nextSingles = this.nextSingles;
        game.bag = this.bag.slice(0);
        game.pieceSpeed = this.pieceSpeed;
        game.redraw = true;
    }
}

function saveHist() {
    gameHistory.push(new GameHistory());
}

function restoreHist() {
    if (gameHistory.length > 1) {
        gameHistory.pop();
        gameHistory[gameHistory.length - 1].restore();
    }
}

function resetHist() {
    gameHistory = [];
}