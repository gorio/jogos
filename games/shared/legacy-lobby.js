(function () {
  const CHESS = {
    0: ["r","n","b","q","k","b","n","r"],
    1: ["p","p","p","p","p","p","p","p"],
    6: ["P","P","P","P","P","P","P","P"],
    7: ["R","N","B","Q","K","B","N","R"]
  };

  const SYMBOLS = {
    r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
    R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙"
  };

  function addSquare(board, row, col) {
    const square = document.createElement("div");
    square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");
    square.dataset.row = row;
    square.dataset.col = col;
    board.appendChild(square);
    return square;
  }

  function renderChess(board) {
    board.innerHTML = "";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = addSquare(board, row, col);
        const piece = CHESS[row] && CHESS[row][col];
        if (!piece) continue;
        const span = document.createElement("span");
        span.className = "piece " + (piece === piece.toUpperCase() ? "piece-white" : "piece-black");
        span.textContent = SYMBOLS[piece];
        square.appendChild(span);
      }
    }
  }

  function renderDama(board) {
    board.innerHTML = "";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = addSquare(board, row, col);
        const playable = (row + col) % 2 !== 0;
        if (!playable || (row > 2 && row < 5)) continue;
        const piece = document.createElement("div");
        piece.className = "dama-piece " + (row < 3 ? "piece-preta" : "piece-branca");
        square.appendChild(piece);
      }
    }
  }

  function getLudoConstants() {
    return window.LUDO_CONSTANTS || {};
  }

  function ludoZone(row, col) {
    const constants = getLudoConstants();
    if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return "red-base";
    if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return "blue-base";
    if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return "green-base";
    if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return "yellow-base";
    if (row === 7 && col >= 1 && col <= 6) return "red-homepath";
    if (col === 7 && row >= 1 && row <= 6) return "blue-homepath";
    if (row === 7 && col >= 8 && col <= 13) return "green-homepath";
    if (col === 7 && row >= 8 && row <= 13) return "yellow-homepath";
    if (row === 7 && col === 7) return "center-final";

    for (const color of constants.LUDO_COLORS || []) {
      const pos = constants.ENTRY_POS && constants.ENTRY_POS[color];
      if (pos && pos[0] === row && pos[1] === col) return color + "-entry";
    }

    return "neutral-path";
  }

  function homeYardColor(row, col) {
    if (row >= 1 && row <= 4 && col >= 1 && col <= 4) return "red";
    if (row >= 1 && row <= 4 && col >= 10 && col <= 13) return "blue";
    if (row >= 10 && row <= 13 && col >= 10 && col <= 13) return "green";
    if (row >= 10 && row <= 13 && col >= 1 && col <= 4) return "yellow";
    return null;
  }

  function pocketColor(row, col) {
    const constants = getLudoConstants();
    for (const color of constants.LUDO_COLORS || []) {
      const positions = constants.BASE_POSITIONS && constants.BASE_POSITIONS[color];
      if (positions && positions.some(pos => pos[0] === row && pos[1] === col)) return color;
    }
    return null;
  }

  function isSafeCell(row, col) {
    const constants = getLudoConstants();
    const pathCoords = constants.PATH_COORDS || [];
    const safeSquares = constants.SAFE_SQUARES || [];
    return pathCoords.some((coord, index) => safeSquares.includes(index) && coord[0] === row && coord[1] === col);
  }

  function renderLudo(board) {
    board.innerHTML = "";
    const size = getLudoConstants().BOARD_SIZE || 15;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const cell = document.createElement("div");
        cell.className = "ludo-cell " + ludoZone(row, col);
        const homeColor = homeYardColor(row, col);
        const basePocketColor = pocketColor(row, col);
        if (homeColor) cell.classList.add("home-yard", homeColor + "-yard");
        if (basePocketColor) cell.classList.add("base-pocket", basePocketColor + "-pocket");
        if (isSafeCell(row, col)) cell.classList.add("safe");
        board.appendChild(cell);
      }
    }
  }

  function render() {
    document.querySelectorAll("[data-lobby-board]").forEach(board => {
      const type = board.dataset.lobbyBoard;
      if (type === "xadrez") renderChess(board);
      if (type === "dama") renderDama(board);
      if (type === "ludo") renderLudo(board);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
