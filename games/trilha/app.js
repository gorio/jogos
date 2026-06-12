const POSITIONS = [
  [8,8],[50,8],[92,8],[20,20],[50,20],[80,20],[32,32],[50,32],[68,32],
  [8,50],[20,50],[32,50],[68,50],[80,50],[92,50],
  [32,68],[50,68],[68,68],[20,80],[50,80],[80,80],[8,92],[50,92],[92,92]
];

const MILLS = [
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
  [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
];

const ADJ = {
  0:[1,9],1:[0,2,4],2:[1,14],3:[4,10],4:[1,3,5,7],5:[4,13],6:[7,11],7:[4,6,8],8:[7,12],
  9:[0,10,21],10:[3,9,11,18],11:[6,10,15],12:[8,13,17],13:[5,12,14,20],14:[2,13,23],
  15:[11,16],16:[15,17,19],17:[12,16],18:[10,19],19:[16,18,20,22],20:[13,19],
  21:[9,22],22:[19,21,23],23:[14,22]
};

let board;
let turn;
let selected;
let toPlace;
let removeMode;
let winner;

function resetGame() {
  board = Array(24).fill(null);
  turn = "white";
  selected = null;
  toPlace = { white: 9, black: 9 };
  removeMode = false;
  winner = null;
  render();
}

function other(color) {
  return color === "white" ? "black" : "white";
}

function colorName(color) {
  return color === "white" ? "Brancas" : "Pretas";
}

function isPlacementPhase() {
  return toPlace.white > 0 || toPlace.black > 0;
}

function playerPieces(color) {
  return board.reduce((sum, piece) => sum + (piece === color ? 1 : 0), 0);
}

function formsMill(index, color) {
  return MILLS.some(mill => mill.includes(index) && mill.every(pos => board[pos] === color));
}

function removablePieces(color) {
  const pieces = board.map((piece, index) => piece === color ? index : -1).filter(index => index >= 0);
  const freePieces = pieces.filter(index => !formsMill(index, color));
  return freePieces.length ? freePieces : pieces;
}

function hasMove(color) {
  if (isPlacementPhase()) return true;
  const pieces = board.map((piece, index) => piece === color ? index : -1).filter(index => index >= 0);
  if (pieces.length <= 3) return board.some(piece => !piece);
  return pieces.some(index => ADJ[index].some(dest => !board[dest]));
}

function updateWinner() {
  if (isPlacementPhase()) return;
  const enemy = other(turn);
  if (playerPieces(enemy) < 3) winner = turn;
  else if (!hasMove(enemy)) winner = turn;
}

function finishTurn(createdMill) {
  if (createdMill) {
    removeMode = true;
    selected = null;
    render();
    return;
  }
  updateWinner();
  if (!winner) turn = other(turn);
  selected = null;
  render();
}

function canMove(from, to) {
  if (board[to]) return false;
  if (playerPieces(turn) <= 3) return true;
  return ADJ[from].includes(to);
}

function handleNode(index) {
  if (winner) return;

  if (removeMode) {
    const enemy = other(turn);
    if (board[index] === enemy && removablePieces(enemy).includes(index)) {
      board[index] = null;
      removeMode = false;
      updateWinner();
      if (!winner) turn = enemy;
      render();
    }
    return;
  }

  if (isPlacementPhase()) {
    if (board[index] || toPlace[turn] <= 0) return;
    board[index] = turn;
    toPlace[turn] -= 1;
    finishTurn(formsMill(index, turn));
    return;
  }

  if (selected === null) {
    if (board[index] === turn) selected = index;
    render();
    return;
  }

  if (board[index] === turn) {
    selected = index;
    render();
    return;
  }

  if (canMove(selected, index)) {
    board[index] = turn;
    board[selected] = null;
    finishTurn(formsMill(index, turn));
    return;
  }

  selected = null;
  render();
}

function drawLines(container) {
  const segments = [
    [0,2],[3,5],[6,8],[9,11],[12,14],[15,17],[18,20],[21,23],
    [0,21],[3,18],[6,15],[1,7],[16,22],[8,17],[5,20],[2,23]
  ];
  segments.forEach(([a,b]) => {
    const [x1,y1] = POSITIONS[a];
    const [x2,y2] = POSITIONS[b];
    const line = document.createElement("div");
    line.className = "line " + (x1 === x2 ? "v" : "h");
    if (x1 === x2) {
      line.style.left = x1 + "%";
      line.style.top = Math.min(y1, y2) + "%";
      line.style.height = Math.abs(y2 - y1) + "%";
    } else {
      line.style.top = y1 + "%";
      line.style.left = Math.min(x1, x2) + "%";
      line.style.width = Math.abs(x2 - x1) + "%";
    }
    container.appendChild(line);
  });
}

function render() {
  const container = document.getElementById("board");
  container.classList.toggle("remove-mode", removeMode);
  container.innerHTML = "";
  drawLines(container);

  POSITIONS.forEach(([x,y], index) => {
    const node = document.createElement("button");
    node.className = "node";
    node.style.left = x + "%";
    node.style.top = y + "%";
    node.setAttribute("aria-label", "Casa " + (index + 1));
    if (selected === index) node.classList.add("selected");
    if (selected !== null && canMove(selected, index)) node.classList.add("valid");
    if (removeMode && board[index] === other(turn)) node.classList.add("enemy");

    if (board[index]) {
      const piece = document.createElement("span");
      piece.className = "piece " + board[index];
      node.appendChild(piece);
    }
    node.addEventListener("click", () => handleNode(index));
    container.appendChild(node);
  });

  document.getElementById("white-left").textContent = toPlace.white;
  document.getElementById("black-left").textContent = toPlace.black;
  document.getElementById("phase").textContent = isPlacementPhase() ? "Colocação" : "Movimento";

  const status = document.getElementById("status");
  if (winner) status.textContent = colorName(winner) + " venceram";
  else if (removeMode) status.textContent = colorName(turn) + ": remova uma peça";
  else if (isPlacementPhase()) status.textContent = colorName(turn) + ": coloque uma peça";
  else status.textContent = selected === null ? colorName(turn) + ": escolha uma peça" : colorName(turn) + ": escolha o destino";
}

document.getElementById("btn-reset").addEventListener("click", resetGame);
resetGame();
