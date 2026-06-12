const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCa0WmUo1PIrlaYW6Ei8ZZK3XLZ4i0gIfo",
  authDomain: "golf-oscar-romeo.firebaseapp.com",
  projectId: "golf-oscar-romeo",
  storageBucket: "golf-oscar-romeo.firebasestorage.app",
  databaseURL: "https://golf-oscar-romeo-default-rtdb.firebaseio.com",
  messagingSenderId: "71631208569",
  appId: "1:71631208569:web:e7a1cc7ad20903ce5ad4a8"
};

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

let board = Array(9).fill("");
let turn = "X";
let locked = true;
let mode = "online";
let score = { X: 0, O: 0, draw: 0 };
let winningLine = [];
let onlineRoomRef = null;
let onlineRoomCode = "";
let onlinePlayer = "";
let currentUser = null;
let authReady = false;

function qs(selector) {
  return document.querySelector(selector);
}

function winnerOf(state) {
  for (const line of WINS) {
    const [a,b,c] = line;
    if (state[a] && state[a] === state[b] && state[a] === state[b] && state[a] === state[c]) {
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

function newRoundState() {
  return {
    board: Array(9).fill(""),
    turn: "X",
    winner: "",
    winningLine: [],
    updatedAt: Date.now()
  };
}

function resetLocalRound() {
  board = Array(9).fill("");
  turn = "X";
  locked = mode === "online" && !onlineRoomRef;
  winningLine = [];
  render();
}

function finishLocalIfNeeded() {
  const result = winnerOf(board);
  if (!result) return false;
  locked = true;
  winningLine = result.line;
  if (result.winner === "draw") score.draw += 1;
  else score[result.winner] += 1;
  render();
  return true;
}

function playAi(index) {
  if (locked || board[index]) return;
  if (turn === "O") return;

  board[index] = turn;
  if (finishLocalIfNeeded()) return;
  turn = "O";
  locked = true;
  render();

  setTimeout(() => {
    const aiMove = bestAiMove();
    if (aiMove !== undefined) board[aiMove] = "O";
    locked = false;
    if (!finishLocalIfNeeded()) {
      turn = "X";
      render();
    }
  }, 260);
}

function playerName() {
  if (!currentUser) return "Jogador";
  return currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "Jogador");
}

function roomPath(code) {
  return "games/jogo-da-velha/rooms/" + code;
}

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function setRoomNote(message) {
  qs("#room-note").textContent = message;
}

function showRoomCode(code) {
  const node = qs("#current-room-code");
  const createButton = qs("#btn-create-room");
  const joinRow = qs("#join-room-row");
  const inviteButton = qs("#btn-invite-room");
  node.textContent = code ? "Sala " + code : "";
  node.classList.toggle("active", Boolean(code));
  createButton.classList.toggle("hidden", Boolean(code));
  joinRow.classList.toggle("hidden", Boolean(code));
  inviteButton.classList.toggle("hidden", !code);
}

async function inviteRoom() {
  if (!onlineRoomCode) {
    setRoomNote("Crie uma sala primeiro.");
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("room", onlineRoomCode);
  const text = "Te desafio para uma partida de Jogo da Velha. Código: " + onlineRoomCode + " - " + url.toString();

  try {
    if (navigator.share) {
      await navigator.share({ title: "Desafio de Jogo da Velha", text, url: url.toString() });
      return;
    }
    await navigator.clipboard.writeText(text);
    setRoomNote("Convite copiado. Envie para o outro jogador.");
  } catch (error) {
    setRoomNote("Código da sala: " + onlineRoomCode);
  }
}

function ensureFirebase() {
  if (!window.firebase) {
    setRoomNote("Firebase não carregou. Recarregue a página.");
    return false;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  if (!authReady) {
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      authReady = true;
      if (!user) setRoomNote("Entre pelo portal para jogar online.");
      else if (!onlineRoomRef) setRoomNote("Crie uma sala ou entre com um código.");
    });
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  }
  return true;
}

function attachRoom(ref, code) {
  if (onlineRoomRef) onlineRoomRef.off();
  onlineRoomRef = ref;
  onlineRoomCode = code;
  showRoomCode(code);
  locked = true;

  ref.on("value", snapshot => {
    const room = snapshot.val();
    if (!room) {
      setRoomNote("Sala não encontrada.");
      onlineRoomRef = null;
      onlineRoomCode = "";
      showRoomCode("");
      locked = true;
      render();
      return;
    }

    board = room.board || Array(9).fill("");
    turn = room.turn || "X";
    winningLine = room.winningLine || [];
    const result = room.winner ? { winner: room.winner, line: winningLine } : winnerOf(board);
    locked = Boolean(result) || !onlinePlayer || turn !== onlinePlayer || !room.players?.O;

    if (!room.players?.O) setRoomNote("Compartilhe o código e aguarde outro jogador.");
    else if (result?.winner === "draw") setRoomNote("Empate.");
    else if (result?.winner) setRoomNote(result.winner + " venceu.");
    else setRoomNote(turn === onlinePlayer ? "Sua vez." : "Aguardando o adversário.");

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
  const room = {
    ...newRoundState(),
    players: { X: currentUser.uid, O: "" },
    playerNames: { X: playerName(), O: "" },
    createdAt: Date.now()
  };
  await ref.set(room);
  onlinePlayer = "X";
  attachRoom(ref, code);
}

async function joinRoom() {
  if (!ensureFirebase()) return;
  currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    setRoomNote("Entre pelo portal para entrar em uma sala online.");
    return;
  }

  const code = qs("#room-code-input").value.trim().toUpperCase();
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

  if (room.players?.X === currentUser.uid) onlinePlayer = "X";
  else if (!room.players?.O || room.players.O === currentUser.uid) {
    onlinePlayer = "O";
    await ref.child("players/O").set(currentUser.uid);
    await ref.child("playerNames/O").set(playerName());
  } else {
    setRoomNote("Esta sala já tem dois jogadores.");
    return;
  }

  attachRoom(ref, code);
}

async function resetOnlineRound() {
  if (!onlineRoomRef) return;
  if (onlinePlayer !== "X") {
    setRoomNote("Apenas quem criou a sala pode reiniciar.");
    return;
  }
  await onlineRoomRef.update(newRoundState());
}

async function playOnline(index) {
  if (!onlineRoomRef || locked || board[index] || turn !== onlinePlayer) return;
  const nextBoard = board.slice();
  nextBoard[index] = onlinePlayer;
  const result = winnerOf(nextBoard);
  const payload = {
    board: nextBoard,
    turn: result ? turn : (turn === "X" ? "O" : "X"),
    winner: result ? result.winner : "",
    winningLine: result ? result.line : [],
    updatedAt: Date.now()
  };
  await onlineRoomRef.update(payload);
}

function play(index) {
  if (mode === "ai") playAi(index);
  else playOnline(index);
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".mode-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  qs("#panel-online").classList.toggle("active", mode === "online");
  qs("#panel-ai").classList.toggle("active", mode === "ai");

  if (mode === "ai") {
    if (onlineRoomRef) onlineRoomRef.off();
    onlineRoomRef = null;
    onlineRoomCode = "";
    onlinePlayer = "";
    showRoomCode("");
    resetLocalRound();
    locked = false;
  } else {
    resetLocalRound();
    locked = true;
    ensureFirebase();
  }
  render();
}

function statusText() {
  const result = winnerOf(board);
  if (result?.winner === "draw") return "Empate";
  if (result?.winner) return result.winner + " venceu";
  if (mode === "ai" && turn === "O") return "Computador pensando";
  if (mode === "online" && !onlineRoomRef) return "Escolha ou crie uma sala";
  if (mode === "online" && !onlinePlayer) return "Entrando na sala";
  if (mode === "online" && turn !== onlinePlayer) return "Vez do adversário";
  return "Vez de " + turn;
}

function render() {
  const container = qs("#board");
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
    cell.disabled = locked || Boolean(value);
    cell.addEventListener("click", () => play(index));
    container.appendChild(cell);
  });
  qs("#status").textContent = statusText();
  qs("#score-x").textContent = score.X;
  qs("#score-o").textContent = score.O;
  qs("#score-draw").textContent = score.draw;
}

qs("#btn-reset").addEventListener("click", () => {
  if (mode === "online") resetOnlineRound();
  else resetLocalRound();
});
qs("#mode-online").addEventListener("click", () => setMode("online"));
qs("#mode-ai").addEventListener("click", () => setMode("ai"));
qs("#btn-create-room").addEventListener("click", createRoom);
qs("#btn-join-room").addEventListener("click", joinRoom);
qs("#btn-invite-room").addEventListener("click", inviteRoom);
qs("#btn-start-ai").addEventListener("click", () => setMode("ai"));
qs("#room-code-input").addEventListener("input", event => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

ensureFirebase();
setMode("online");
const requestedRoom = new URLSearchParams(window.location.search).get("room");
if (requestedRoom) qs("#room-code-input").value = requestedRoom.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
