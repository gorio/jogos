const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCa0WmUo1PIrlaYW6Ei8ZZK3XLZ4i0gIfo",
  authDomain: "golf-oscar-romeo.firebaseapp.com",
  projectId: "golf-oscar-romeo",
  storageBucket: "golf-oscar-romeo.firebasestorage.app",
  databaseURL: "https://golf-oscar-romeo-default-rtdb.firebaseio.com",
  messagingSenderId: "71631208569",
  appId: "1:71631208569:web:e7a1cc7ad20903ce5ad4a8"
};

const GAME_ROUTES = {
  xadrez: { label: "Xadrez", url: "games/xadrez/" },
  dama: { label: "Dama", url: "games/dama/" },
  ludo: { label: "Ludo", url: "games/ludo/" },
  trilha: { label: "Trilha", url: "games/trilha/" },
  "resta-um": { label: "Resta Um", url: "games/resta-um/" },
  "jogo-da-velha": { label: "Jogo da Velha", url: "games/jogo-da-velha/" }
};

let auth;
let currentUser = null;

function qs(selector) {
  return document.querySelector(selector);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  qs("#screen-" + name).classList.add("active");
}

function setText(selector, value) {
  const node = qs(selector);
  if (node) node.textContent = value || "";
}

function showError(message) {
  setText("#auth-error", message || "");
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] ? part[0].toUpperCase() : "")
    .join("") || "?";
}

function authMessage(error) {
  const messages = {
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "E-mail já cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "Senha muito fraca.",
    "auth/too-many-requests": "Muitas tentativas. Tente mais tarde.",
    "auth/popup-closed-by-user": ""
  };
  return messages[error && error.code] || "Não foi possível autenticar.";
}

function updateUserHeader(user) {
  const displayName = user.displayName || (user.email ? user.email.split("@")[0] : "Jogador");
  setText("#header-username", displayName);

  const photo = qs("#header-photo");
  const fallback = qs("#header-initials");
  if (photo && fallback) {
    if (user.photoURL) {
      photo.src = user.photoURL;
      photo.classList.remove("hidden");
      fallback.classList.add("hidden");
    } else {
      photo.src = "";
      photo.classList.add("hidden");
      fallback.textContent = initials(displayName);
      fallback.classList.remove("hidden");
    }
  }
}

function openGame(gameKey) {
  if (!currentUser) {
    showScreen("auth");
    showError("Entre para acessar os jogos.");
    return;
  }
  const game = GAME_ROUTES[gameKey];
  if (!game) return;
  localStorage.setItem("jogos:lastGame", gameKey);
  window.location.href = game.url;
}

function addPreviewSquare(board, row, col) {
  const square = document.createElement("div");
  square.className = "portal-square " + ((row + col) % 2 === 0 ? "light" : "dark");
  board.appendChild(square);
  return square;
}

function renderChessPreview(board) {
  const setup = {
    0: ["r", "n", "b", "q", "k", "b", "n", "r"],
    1: ["p", "p", "p", "p", "p", "p", "p", "p"],
    6: ["P", "P", "P", "P", "P", "P", "P", "P"],
    7: ["R", "N", "B", "Q", "K", "B", "N", "R"]
  };
  const symbols = {
    r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
    R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙"
  };

  board.innerHTML = "";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = addPreviewSquare(board, row, col);
      const piece = setup[row] && setup[row][col];
      if (!piece) continue;
      const node = document.createElement("span");
      node.className = "portal-piece " + (piece === piece.toUpperCase() ? "white" : "black");
      node.textContent = symbols[piece];
      square.appendChild(node);
    }
  }
}

function renderDamaPreview(board) {
  board.innerHTML = "";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = addPreviewSquare(board, row, col);
      const playable = (row + col) % 2 !== 0;
      if (!playable || (row > 2 && row < 5)) continue;
      const piece = document.createElement("span");
      piece.className = "portal-man " + (row < 3 ? "black" : "white");
      square.appendChild(piece);
    }
  }
}

function ludoPreviewZone(row, col) {
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return "red-base";
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return "blue-base";
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return "green-base";
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return "yellow-base";
  if (row === 7 && col >= 1 && col <= 6) return "red-homepath";
  if (col === 7 && row >= 1 && row <= 6) return "blue-homepath";
  if (row === 7 && col >= 8 && col <= 13) return "green-homepath";
  if (col === 7 && row >= 8 && row <= 13) return "yellow-homepath";
  if (row === 7 && col === 7) return "center-final";
  if (row === 6 && col === 1) return "red-entry";
  if (row === 1 && col === 8) return "blue-entry";
  if (row === 8 && col === 13) return "green-entry";
  if (row === 13 && col === 6) return "yellow-entry";
  return "neutral-path";
}

function renderLudoPreview(board) {
  const safe = new Set(["6,1", "2,6", "1,8", "6,12", "8,13", "12,8", "13,6", "8,2"]);
  const pockets = new Set(["1,1", "1,2", "2,1", "2,2", "1,12", "1,13", "2,12", "2,13", "12,12", "12,13", "13,12", "13,13", "12,1", "12,2", "13,1", "13,2"]);

  board.innerHTML = "";
  for (let row = 0; row < 15; row += 1) {
    for (let col = 0; col < 15; col += 1) {
      const cell = document.createElement("span");
      const key = row + "," + col;
      cell.className = "portal-ludo-cell " + ludoPreviewZone(row, col);
      if ((row >= 1 && row <= 4 && col >= 1 && col <= 4) ||
          (row >= 1 && row <= 4 && col >= 10 && col <= 13) ||
          (row >= 10 && row <= 13 && col >= 1 && col <= 4) ||
          (row >= 10 && row <= 13 && col >= 10 && col <= 13)) {
        cell.classList.add("home-yard");
      }
      if (pockets.has(key)) cell.classList.add("base-pocket");
      if (safe.has(key)) cell.classList.add("safe");
      board.appendChild(cell);
    }
  }
}

function renderGamePreviews() {
  document.querySelectorAll("[data-preview-board]").forEach(board => {
    if (board.dataset.previewBoard === "xadrez") renderChessPreview(board);
    if (board.dataset.previewBoard === "dama") renderDamaPreview(board);
    if (board.dataset.previewBoard === "ludo") renderLudoPreview(board);
  });
}

async function loginWithEmail() {
  const email = qs("#login-email").value.trim();
  const password = qs("#login-password").value;
  if (!email || !password) {
    showError("Preencha e-mail e senha.");
    return;
  }
  try {
    showError("");
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    showError(authMessage(error));
  }
}

async function registerWithEmail() {
  const name = qs("#reg-name").value.trim();
  const email = qs("#reg-email").value.trim();
  const password = qs("#reg-password").value;
  if (!name || !email || password.length < 6) {
    showError("Informe nome, e-mail e senha com pelo menos 6 caracteres.");
    return;
  }
  try {
    showError("");
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: name });
    updateUserHeader(credential.user);
  } catch (error) {
    showError(authMessage(error));
  }
}

async function loginWithGoogle() {
  try {
    showError("");
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    const message = authMessage(error);
    if (message) showError(message);
  }
}

function bindAuthTabs() {
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      qs("#tab-login").classList.toggle("hidden", target !== "login");
      qs("#tab-register").classList.toggle("hidden", target !== "register");
      showError("");
    });
  });
}

function bindActions() {
  qs("#btn-login-email").addEventListener("click", loginWithEmail);
  qs("#login-password").addEventListener("keydown", event => {
    if (event.key === "Enter") loginWithEmail();
  });
  qs("#btn-register").addEventListener("click", registerWithEmail);
  qs("#btn-login-google").addEventListener("click", loginWithGoogle);
  qs("#btn-register-google").addEventListener("click", loginWithGoogle);
  qs("#btn-logout").addEventListener("click", () => auth.signOut());

  document.querySelectorAll("[data-open-game]").forEach(button => {
    button.addEventListener("click", () => openGame(button.dataset.openGame));
  });

  qs("#btn-open-last").addEventListener("click", () => {
    openGame(localStorage.getItem("jogos:lastGame") || "xadrez");
  });
}

window.addEventListener("DOMContentLoaded", () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  bindAuthTabs();
  bindActions();
  renderGamePreviews();

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      updateUserHeader(user);
      showScreen("hub");
    } else {
      showScreen("auth");
    }
  });
});
