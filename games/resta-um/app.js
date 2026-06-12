const INVALID = new Set(["0,0","0,1","1,0","1,1","0,5","0,6","1,5","1,6","5,0","5,1","6,0","6,1","5,5","5,6","6,5","6,6"]);
const CENTER = "3,3";
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

let board;
let selected;
let history;

function key(r, c) {
  return r + "," + c;
}

function parse(pos) {
  return pos.split(",").map(Number);
}

function validCell(r, c) {
  return r >= 0 && r < 7 && c >= 0 && c < 7 && !INVALID.has(key(r,c));
}

function resetGame() {
  board = {};
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (validCell(r,c)) board[key(r,c)] = key(r,c) !== CENTER;
    }
  }
  selected = null;
  history = [];
  render();
}

function cloneState() {
  return JSON.parse(JSON.stringify(board));
}

function pegCount() {
  return Object.values(board).filter(Boolean).length;
}

function legalMovesFrom(pos) {
  if (!board[pos]) return [];
  const [r,c] = parse(pos);
  const moves = [];
  DIRS.forEach(([dr,dc]) => {
    const mid = key(r + dr, c + dc);
    const to = key(r + 2 * dr, c + 2 * dc);
    if (validCell(r + 2 * dr, c + 2 * dc) && board[mid] && board[to] === false) {
      moves.push({ from: pos, over: mid, to });
    }
  });
  return moves;
}

function allLegalMoves() {
  return Object.keys(board).flatMap(legalMovesFrom);
}

function handleCell(pos) {
  if (!(pos in board)) return;
  const moves = selected ? legalMovesFrom(selected) : [];
  const move = moves.find(item => item.to === pos);

  if (move) {
    history.push(cloneState());
    board[move.from] = false;
    board[move.over] = false;
    board[move.to] = true;
    selected = null;
    render();
    return;
  }

  if (board[pos] && legalMovesFrom(pos).length) {
    selected = pos;
  } else {
    selected = null;
  }
  render();
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  board = previous;
  selected = null;
  render();
}

function render() {
  const container = document.getElementById("board");
  container.innerHTML = "";
  const legalTargets = selected ? new Set(legalMovesFrom(selected).map(move => move.to)) : new Set();

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const pos = key(r,c);
      const cell = document.createElement("button");
      cell.className = "hole";
      if (!validCell(r,c)) cell.classList.add("invalid");
      if (selected === pos) cell.classList.add("selected");
      if (legalTargets.has(pos)) cell.classList.add("valid");
      cell.setAttribute("aria-label", "Linha " + (r + 1) + ", coluna " + (c + 1));
      if (validCell(r,c)) {
        cell.addEventListener("click", () => handleCell(pos));
        if (board[pos]) {
          const peg = document.createElement("span");
          peg.className = "peg";
          cell.appendChild(peg);
        }
      }
      container.appendChild(cell);
    }
  }

  const moves = allLegalMoves();
  const count = pegCount();
  const won = count === 1 && board[CENTER];
  document.getElementById("peg-count").textContent = count;
  document.getElementById("move-count").textContent = history.length;
  document.getElementById("best-state").textContent = won ? "Perfeito" : (moves.length ? "-" : "Fim");

  const status = document.getElementById("status");
  if (won) status.textContent = "Vitória perfeita: restou uma peça no centro";
  else if (!moves.length) status.textContent = "Sem movimentos: tente novamente";
  else if (selected) status.textContent = "Escolha a casa de destino";
  else status.textContent = "Escolha uma peça com salto disponível";
}

document.getElementById("btn-reset").addEventListener("click", resetGame);
document.getElementById("btn-undo").addEventListener("click", undo);
resetGame();
