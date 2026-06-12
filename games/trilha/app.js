const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCa0WmUo1PIrlaYW6Ei8ZZK3XLZ4i0gIfo",
  authDomain: "golf-oscar-romeo.firebaseapp.com",
  projectId: "golf-oscar-romeo",
  storageBucket: "golf-oscar-romeo.firebasestorage.app",
  databaseURL: "https://golf-oscar-romeo-default-rtdb.firebaseio.com",
  messagingSenderId: "71631208569",
  appId: "1:71631208569:web:e7a1cc7ad20903ce5ad4a8"
};

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
let mode = "ai";
let aiColor = "black";
let aiThinking = false;
let onlineRoomRef = null;
let onlineRoomCode = "";
let onlineColor = "";
let currentUser = null;
let authReady = false;

function qs(selector) {
  return document.querySelector(selector);
}

function initialGameState() {
  return {
    board: Array(24).fill(null),
    turn: "white",
    toPlace: { white: 9, black: 9 },
    removeMode: false,
    winner: null,
    updatedAt: Date.now()
  };
}

function applyState(state) {
  board = Array.isArray(state?.board) ? state.board.slice(0, 24) : Array(24).fill(null);
  while (board.length < 24) board.push(null);
  turn = state?.turn === "black" ? "black" : "white";
  toPlace = {
    white: Number.isInteger(state?.toPlace?.white) ? state.toPlace.white : 9,
    black: Number.isInteger(state?.toPlace?.black) ? state.toPlace.black : 9
  };
  removeMode = Boolean(state?.removeMode);
  winner = state?.winner || null;
}

function resetGame() {
  applyState(initialGameState());
  selected = null;
  aiThinking = false;
  render();
  maybeAiTurn();
}

function other(color) {
  return color === "white" ? "black" : "white";
}

function colorName(color) {
  return color === "white" ? "Brancas" : "Pretas";
}

function playerName() {
  if (!currentUser) return "Jogador";
  return currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "Jogador");
}

function roomPath(code) {
  return "games/trilha/rooms/" + code;
}

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function setRoomNote(message) {
  const node = qs("#room-note");
  if (node) node.textContent = message;
}

function showRoomCode(code) {
  const node = qs("#current-room-code");
  if (!node) return;
  node.textContent = code ? "Sala " + code : "";
  node.classList.toggle("active", Boolean(code));
}

function ensureFirebase() {
  if (!window.firebase) {
    setRoomNote("Firebase não carregou. Recarregue a página.");
    return false;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  if (!authReady) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      authReady = true;
      if (!user) setRoomNote("Entre pelo portal para jogar online.");
      else if (!onlineRoomRef) setRoomNote("Crie uma sala ou entre com um código.");
    });
  }
  return true;
}

function isPlacementPhase(place = toPlace) {
  return place.white > 0 || place.black > 0;
}

function playerPieces(color, stateBoard = board) {
  return stateBoard.reduce((sum, piece) => sum + (piece === color ? 1 : 0), 0);
}

function formsMill(index, color, stateBoard = board) {
  return MILLS.some(mill => mill.includes(index) && mill.every(pos => stateBoard[pos] === color));
}

function removablePieces(color, stateBoard = board) {
  const pieces = stateBoard.map((piece, index) => piece === color ? index : -1).filter(index => index >= 0);
  const freePieces = pieces.filter(index => !formsMill(index, color, stateBoard));
  return freePieces.length ? freePieces : pieces;
}

function hasMove(color, stateBoard = board, place = toPlace) {
  if (isPlacementPhase(place)) return true;
  const pieces = stateBoard.map((piece, index) => piece === color ? index : -1).filter(index => index >= 0);
  if (pieces.length <= 3) return stateBoard.some(piece => !piece);
  return pieces.some(index => ADJ[index].some(dest => !stateBoard[dest]));
}

function resolveWinner(stateBoard = board, stateTurn = turn, place = toPlace) {
  if (isPlacementPhase(place)) return null;
  const enemy = other(stateTurn);
  if (playerPieces(enemy, stateBoard) < 3) return stateTurn;
  if (!hasMove(enemy, stateBoard, place)) return stateTurn;
  return null;
}

function updateWinner() {
  winner = resolveWinner(board, turn, toPlace);
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
  maybeAiTurn();
}

function canMove(from, to, color = turn, stateBoard = board) {
  if (stateBoard[to]) return false;
  if (playerPieces(color, stateBoard) <= 3) return true;
  return ADJ[from].includes(to);
}

function isMyOnlineTurn() {
  return mode === "online" && onlineRoomRef && onlineColor && turn === onlineColor && !winner;
}

function hasOpponent() {
  return mode !== "online" || Boolean(window.lastTrilhaRoom?.players?.black);
}

function handleLocalNode(index) {
  if (winner || aiThinking) return;
  if (mode === "ai" && turn === aiColor) return;

  if (removeMode) {
    const enemy = other(turn);
    if (board[index] === enemy && removablePieces(enemy).includes(index)) {
      board[index] = null;
      removeMode = false;
      updateWinner();
      if (!winner) turn = enemy;
      render();
      maybeAiTurn();
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

async function publishOnlineState(nextBoard, nextTurn, nextToPlace, nextRemoveMode, nextWinner) {
  if (!onlineRoomRef) return;
  await onlineRoomRef.update({
    board: nextBoard,
    turn: nextTurn,
    toPlace: nextToPlace,
    removeMode: nextRemoveMode,
    winner: nextWinner || null,
    updatedAt: Date.now()
  });
}

async function handleOnlineNode(index) {
  if (!isMyOnlineTurn()) return;
  if (!hasOpponent()) {
    setRoomNote("Aguardando outro jogador entrar na sala.");
    return;
  }

  const nextBoard = board.slice();
  const nextToPlace = { ...toPlace };

  if (removeMode) {
    const enemy = other(turn);
    if (nextBoard[index] !== enemy || !removablePieces(enemy, nextBoard).includes(index)) return;
    nextBoard[index] = null;
    const nextWinner = resolveWinner(nextBoard, turn, nextToPlace);
    await publishOnlineState(nextBoard, nextWinner ? turn : enemy, nextToPlace, false, nextWinner);
    return;
  }

  if (isPlacementPhase(nextToPlace)) {
    if (nextBoard[index] || nextToPlace[turn] <= 0) return;
    nextBoard[index] = turn;
    nextToPlace[turn] -= 1;
    const createdMill = formsMill(index, turn, nextBoard);
    const nextWinner = createdMill ? null : resolveWinner(nextBoard, turn, nextToPlace);
    await publishOnlineState(nextBoard, nextWinner ? turn : (createdMill ? turn : other(turn)), nextToPlace, createdMill, nextWinner);
    return;
  }

  if (selected === null) {
    if (nextBoard[index] === turn) selected = index;
    render();
    return;
  }

  if (nextBoard[index] === turn) {
    selected = index;
    render();
    return;
  }

  if (canMove(selected, index, turn, nextBoard)) {
    nextBoard[index] = turn;
    nextBoard[selected] = null;
    selected = null;
    const createdMill = formsMill(index, turn, nextBoard);
    const nextWinner = createdMill ? null : resolveWinner(nextBoard, turn, nextToPlace);
    await publishOnlineState(nextBoard, nextWinner ? turn : (createdMill ? turn : other(turn)), nextToPlace, createdMill, nextWinner);
    return;
  }

  selected = null;
  render();
}

function handleNode(index) {
  if (mode === "online") handleOnlineNode(index);
  else handleLocalNode(index);
}

function emptyPositions() {
  return board.map((piece, index) => piece ? -1 : index).filter(index => index >= 0);
}

function aiPlacementMove() {
  return emptyPositions()[0];
}

function aiMovementMove(color) {
  const pieces = board.map((piece, index) => piece === color ? index : -1).filter(index => index >= 0);
  const canFly = pieces.length <= 3;
  for (const from of pieces) {
    const targets = canFly ? emptyPositions() : ADJ[from].filter(dest => !board[dest]);
    if (targets.length) return { from, to: targets[0] };
  }
  return null;
}

function aiRemoveMove(color) {
  return removablePieces(other(color))[0];
}

function applyAiMove() {
  if (winner || mode !== "ai" || turn !== aiColor) return;

  if (removeMode) {
    const target = aiRemoveMove(aiColor);
    if (target !== undefined) {
      board[target] = null;
      removeMode = false;
      updateWinner();
      if (!winner) turn = other(aiColor);
      render();
    }
    aiThinking = false;
    return;
  }

  if (isPlacementPhase()) {
    const target = aiPlacementMove(aiColor);
    if (target !== undefined) {
      board[target] = aiColor;
      toPlace[aiColor] -= 1;
      aiThinking = false;
      finishTurn(formsMill(target, aiColor));
      return;
    }
  } else {
    const move = aiMovementMove(aiColor);
    if (move) {
      board[move.to] = aiColor;
      board[move.from] = null;
      aiThinking = false;
      finishTurn(formsMill(move.to, aiColor));
      return;
    }
  }

  aiThinking = false;
  updateWinner();
  render();
}

function maybeAiTurn() {
  if (mode !== "ai" || winner || turn !== aiColor || aiThinking) return;
  aiThinking = true;
  render();
  setTimeout(applyAiMove, 420);
}

function detachRoom() {
  if (onlineRoomRef) onlineRoomRef.off();
  onlineRoomRef = null;
  onlineRoomCode = "";
  onlineColor = "";
  window.lastTrilhaRoom = null;
  showRoomCode("");
}

function attachRoom(ref, code, color) {
  detachRoom();
  onlineRoomRef = ref;
  onlineRoomCode = code;
  onlineColor = color;
  showRoomCode(code);
  selected = null;

  ref.on("value", snapshot => {
    const room = snapshot.val();
    if (!room) {
      setRoomNote("Sala não encontrada.");
      detachRoom();
      resetGame();
      return;
    }

    window.lastTrilhaRoom = room;
    applyState(room);

    if (!room.players?.black) setRoomNote("Compartilhe o código e aguarde outro jogador.");
    else if (winner) setRoomNote(colorName(winner) + " venceram.");
    else if (turn === onlineColor) setRoomNote(removeMode ? "Sua vez: remova uma peça." : "Sua vez.");
    else setRoomNote("Aguardando jogada do adversário.");

    render();
  });
}

async function createRoom() {
  if (!ensureFirebase()) return;
  currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    setRoomNote("Entre pelo portal para criar uma sala online.");
    return;
  }

  const code = roomCode();
  const ref = firebase.database().ref(roomPath(code));
  await ref.set({
    ...initialGameState(),
    players: { white: currentUser.uid, black: "" },
    playerNames: { white: playerName(), black: "" },
    createdAt: Date.now()
  });
  attachRoom(ref, code, "white");
}

async function joinRoom() {
  if (!ensureFirebase()) return;
  currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    setRoomNote("Entre pelo portal para entrar em uma sala online.");
    return;
  }

  const input = qs("#room-code-input");
  const code = input.value.trim().toUpperCase();
  if (!code) {
    setRoomNote("Informe o código da sala.");
    return;
  }

  const ref = firebase.database().ref(roomPath(code));
  const snapshot = await ref.get();
  const room = snapshot.val();
  if (!room) {
    setRoomNote("Sala não encontrada.");
    return;
  }

  if (room.players?.white === currentUser.uid) {
    attachRoom(ref, code, "white");
    return;
  }

  if (!room.players?.black || room.players.black === currentUser.uid) {
    await ref.update({
      "players/black": currentUser.uid,
      "playerNames/black": playerName(),
      updatedAt: Date.now()
    });
    attachRoom(ref, code, "black");
    return;
  }

  setRoomNote("Esta sala já tem dois jogadores.");
}

async function resetOnlineGame() {
  if (!onlineRoomRef) return;
  if (onlineColor !== "white") {
    setRoomNote("Apenas quem criou a sala pode iniciar uma nova partida.");
    return;
  }
  await onlineRoomRef.update(initialGameState());
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".mode-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  qs("#panel-online").classList.toggle("active", mode === "online");
  qs("#panel-ai").classList.toggle("active", mode === "ai");

  if (mode === "ai") {
    detachRoom();
    resetGame();
  } else {
    selected = null;
    resetGame();
    ensureFirebase();
  }
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

function statusText() {
  if (winner) return colorName(winner) + " venceram";
  if (mode === "online" && !onlineRoomRef) return "Crie ou entre em uma sala";
  if (mode === "online" && !hasOpponent()) return "Aguardando adversário";
  if (mode === "online" && turn !== onlineColor) return "Vez do adversário";
  if (aiThinking) return "Computador pensando";
  if (removeMode) return colorName(turn) + ": remova uma peça";
  if (isPlacementPhase()) return colorName(turn) + ": coloque uma peça";
  return selected === null ? colorName(turn) + ": escolha uma peça" : colorName(turn) + ": escolha o destino";
}

function render() {
  const container = qs("#board");
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

  qs("#white-left").textContent = toPlace.white;
  qs("#black-left").textContent = toPlace.black;
  qs("#phase").textContent = isPlacementPhase() ? "Colocação" : "Movimento";
  qs("#status").textContent = statusText();
}

qs("#btn-reset").addEventListener("click", () => {
  if (mode === "online") resetOnlineGame();
  else resetGame();
});
qs("#mode-online").addEventListener("click", () => setMode("online"));
qs("#mode-ai").addEventListener("click", () => setMode("ai"));
qs("#btn-create-room").addEventListener("click", createRoom);
qs("#btn-join-room").addEventListener("click", joinRoom);
qs("#btn-start-ai").addEventListener("click", () => setMode("ai"));
qs("#room-code-input").addEventListener("input", event => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

ensureFirebase();
setMode("online");
