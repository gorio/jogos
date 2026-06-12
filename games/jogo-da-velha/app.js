const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

let board;
let turn;
let locked;
let mode = "local";
let score = { X: 0, O: 0, draw: 0 };
let winningLine = [];

function resetRound() {
  board = Array(9).fill("");
  turn = "X";
  locked = false;
  winningLine = [];
  render();
}

function winnerOf(state) {
  for (const line of WINS) {
    const [a,b,c] = line;
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return { winner: state[a], line };
    }
  }
  if (state.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

function available(state) {
  return state.map((value, index) => value ? -1 : index).filter(index => index >= 0);
}

function minimax(state, player) {
  const result = winnerOf(state);
  if (result) {
    if (result.winner === "O") return 10;
    if (result.winner === "X") return -10;
    return 0;
  }

  const moves = available(state);
  if (player === "O") {
    let best = -Infinity;
    moves.forEach(index => {
      state[index] = "O";
      best = Math.max(best, minimax(state, "X"));
      state[index] = "";
    });
    return best;
  }

  let best = Infinity;
  moves.forEach(index => {
    state[index] = "X";
    best = Math.min(best, minimax(state, "O"));
    state[index] = "";
  });
  return best;
}

function bestAiMove() {
  let bestScore = -Infinity;
  let bestMove = available(board)[0];
  available(board).forEach(index => {
    board[index] = "O";
    const scoreValue = minimax(board, "X");
    board[index] = "";
    if (scoreValue > bestScore) {
      bestScore = scoreValue;
      bestMove = index;
    }
  });
  return bestMove;
}

function finishIfNeeded() {
  const result = winnerOf(board);
  if (!result) return false;
  locked = true;
  winningLine = result.line;
  if (result.winner === "draw") score.draw += 1;
  else score[result.winner] += 1;
  render();
  return true;
}

function play(index) {
  if (locked || board[index]) return;
  if (mode === "ai" && turn === "O") return;

  board[index] = turn;
  if (finishIfNeeded()) return;
  turn = turn === "X" ? "O" : "X";
  render();

  if (mode === "ai" && turn === "O") {
    locked = true;
    render();
    setTimeout(() => {
      const aiMove = bestAiMove();
      board[aiMove] = "O";
      locked = false;
      if (!finishIfNeeded()) {
        turn = "X";
        render();
      }
    }, 260);
  }
}

function setMode(nextMode) {
  mode = nextMode;
  document.getElementById("mode-local").classList.toggle("active", mode === "local");
  document.getElementById("mode-ai").classList.toggle("active", mode === "ai");
  resetRound();
}

function statusText() {
  const result = winnerOf(board);
  if (result?.winner === "draw") return "Empate";
  if (result?.winner) return result.winner + " venceu";
  if (mode === "ai" && turn === "O") return "Computador pensando";
  return "Vez de " + turn;
}

function render() {
  const container = document.getElementById("board");
  container.innerHTML = "";
  board.forEach((value, index) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    if (value) {
      cell.classList.add(value === "X" ? "mark-x" : "mark-o");
      cell.dataset.mark = value;
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      cell.appendChild(mark);
    }
    if (winningLine.includes(index)) cell.classList.add("win");
    cell.setAttribute("aria-label", "Casa " + (index + 1) + (value ? ", " + value : ", vazia"));
    cell.addEventListener("click", () => play(index));
    container.appendChild(cell);
  });
  document.getElementById("status").textContent = statusText();
  document.getElementById("score-x").textContent = score.X;
  document.getElementById("score-o").textContent = score.O;
  document.getElementById("score-draw").textContent = score.draw;
}

document.getElementById("btn-reset").addEventListener("click", resetRound);
document.getElementById("mode-local").addEventListener("click", () => setMode("local"));
document.getElementById("mode-ai").addEventListener("click", () => setMode("ai"));
resetRound();
