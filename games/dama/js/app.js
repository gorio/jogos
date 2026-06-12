/* =====================================================
   DAMA ONLINE — App Principal
===================================================== */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCa0WmUo1PIrlaYW6Ei8ZZK3XLZ4i0gIfo",
  authDomain:        "golf-oscar-romeo.firebaseapp.com",
  projectId:         "golf-oscar-romeo",
  storageBucket:     "golf-oscar-romeo.firebasestorage.app",
  databaseURL:       "https://golf-oscar-romeo-default-rtdb.firebaseio.com",
  messagingSenderId: "71631208569",
  appId:             "1:71631208569:web:e7a1cc7ad20903ce5ad4a8"
};

/* =====================================================
   ESTADO GLOBAL
===================================================== */
let db, fbAuth, currentUser = null;
let engine             = new DamaEngine();
let ai                 = new DamaAI();
let myColor            = null;
let myId               = 'guest_' + Math.random().toString(36).slice(2, 8);
let roomCode           = null;
let roomRef            = null;
let specRef            = null;
let selectedSq         = null;
let legalMovesCache    = [];
let gameActive         = false;
let gameMode           = 'multiplayer';
let aiColor            = 'b';
let aiThinking         = false;
let selectedDiff       = 'intermediario';
let selectedPlayerColor = 'w';
let isSpectator        = false;
let opponentNameGlobal = 'Oponente';

/* replay */
let replayMoves    = [];
let replayIndex    = 0;
let replayEngine   = null;
let replayInterval = null;

/* =====================================================
   HELPER — addEventListener seguro
===================================================== */
function el(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
  else console.warn(`#${id} não encontrado para evento '${event}'`);
}

/* =====================================================
   BOOT
===================================================== */
window.addEventListener('DOMContentLoaded', () => {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db     = firebase.database();
    fbAuth = firebase.auth();
  } catch (e) { console.error('Firebase init:', e); return; }

  initAuthUI();
  initLobbyUI();
  initGameUI();
  initHistoryUI();
  initReplayUI();

  fbAuth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      myId = user.uid;
      const name     = user.displayName || user.email?.split('@')[0] || 'Jogador';
      const photoURL = user.photoURL || null;

      const headerName = document.getElementById('header-username');
      if (headerName) headerName.textContent = name;

      const hPhoto    = document.getElementById('header-photo');
      const hInitials = document.getElementById('header-initials');
      if (photoURL && hPhoto && hInitials) {
        hPhoto.src = photoURL;
        hPhoto.classList.remove('hidden');
        hInitials.style.display = 'none';
      } else if (hInitials) {
        hInitials.style.display = 'flex';
        hInitials.textContent = name.split(' ').slice(0,2)
          .map(w => w[0]?.toUpperCase()||'').join('') || '?';
      }

      window._myPhotoURL = photoURL;
      db.ref('users/' + user.uid).update({
        displayName: name, email: user.email||'',
        photoURL: photoURL||'', lastSeen: Date.now()
      });
      showScreen('lobby');
    } else {
      const hPhoto    = document.getElementById('header-photo');
      const hInitials = document.getElementById('header-initials');
      if (hPhoto)    { hPhoto.src = ''; hPhoto.classList.add('hidden'); }
      if (hInitials) { hInitials.style.display = 'flex'; hInitials.textContent = '?'; }
      window._myPhotoURL = null;
      showScreen('auth');
    }
  });
});

/* =====================================================
   INIT — Auth
===================================================== */
function initAuthUI() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      const tl = document.getElementById('tab-login');
      const tr = document.getElementById('tab-register');
      if (tl) tl.classList.toggle('hidden', target !== 'login');
      if (tr) tr.classList.toggle('hidden', target !== 'register');
      clearAuthError();
    });
  });

  el('btn-login-email',     'click',   loginWithEmail);
  el('login-password',      'keydown', e => { if (e.key === 'Enter') loginWithEmail(); });
  el('btn-login-google',    'click',   loginWithGoogle);
  el('btn-register',        'click',   registerWithEmail);
  el('btn-register-google', 'click',   loginWithGoogle);
  // REMOVIDO: el('btn-guest', 'click', loginAsGuest);
}

async function loginWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showAuthError('Preencha e-mail e senha.'); return; }
  try { await fbAuth.signInWithEmailAndPassword(email, pass); }
  catch (e) { showAuthError(authErrorMsg(e.code)); }
}

async function loginWithGoogle() {
  try { await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch (e) { if (e.code !== 'auth/popup-closed-by-user') showAuthError(authErrorMsg(e.code)); }
}

async function registerWithEmail() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-password').value;
  if (!name)           { showAuthError('Informe seu nome.'); return; }
  if (!email)          { showAuthError('Informe seu e-mail.'); return; }
  if (pass.length < 6) { showAuthError('Senha mínima de 6 caracteres.'); return; }
  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await cred.user.reload();
  } catch (e) { showAuthError(authErrorMsg(e.code)); }
}

async function loginAsGuest() {
  try {
    const cred = await fbAuth.signInAnonymously();
    await cred.user.updateProfile({ displayName: 'Visitante' });
  } catch (e) { showAuthError('Erro ao entrar como visitante.'); }
}

function authErrorMsg(code) {
  return ({
    'auth/user-not-found':       'Usuário não encontrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/email-already-in-use': 'E-mail já cadastrado.',
    'auth/invalid-email':        'E-mail inválido.',
    'auth/weak-password':        'Senha muito fraca.',
    'auth/too-many-requests':    'Muitas tentativas. Tente mais tarde.'
  })[code] || 'Erro ao autenticar.';
}

function showAuthError(msg) { const e = document.getElementById('auth-error'); if (e) e.textContent = msg; }
function clearAuthError()   { const e = document.getElementById('auth-error'); if (e) e.textContent = ''; }

/* =====================================================
   INIT — Lobby
===================================================== */
function initLobbyUI() {
  el('btn-logout',  'click', () => fbAuth.signOut());
  el('btn-history', 'click', openHistory);
  el('btn-create',  'click', createGame);
  el('btn-join',    'click', joinGame);
  el('input-room',  'keydown', e => { if (e.key === 'Enter') joinGame(); });
  el('btn-spectate',   'click',   spectateGame);
  el('input-spectate', 'keydown', e => { if (e.key === 'Enter') spectateGame(); });
  el('btn-start-ai',   'click',   startAIGame);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.mode;
      const mp = document.getElementById('panel-multiplayer');
      const pa = document.getElementById('panel-ai');
      if (mp) mp.classList.toggle('hidden', gameMode !== 'multiplayer');
      if (pa) pa.classList.toggle('hidden', gameMode !== 'ai');
    });
  });

  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPlayerColor = btn.dataset.color;
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDiff = btn.dataset.level;
    });
  });
}

/* =====================================================
   INIT — Game
===================================================== */
function initGameUI() {
  el('btn-cancel',    'click', cancelGame);
  el('btn-copy',      'click', copyRoomCode);
  el('btn-resign',    'click', resign);
  el('btn-new-game',  'click', goLobby);
  el('btn-back-lobby','click', () => {
    if (specRef) { specRef.off(); specRef = null; }
    goLobby();
  });
  el('btn-gameover-new', 'click', () => {
    hideModal('modal-gameover');
    if (gameMode === 'ai') startAIGame(); else goLobby();
  });
  el('btn-gameover-history', 'click', () => { hideModal('modal-gameover'); openHistory(); });
  el('btn-gameover-lobby',   'click', () => { hideModal('modal-gameover'); goLobby(); });
}

/* =====================================================
   INIT — History / Replay
===================================================== */
function initHistoryUI() { el('btn-history-back', 'click', goLobby); }

function initReplayUI() {
  el('btn-replay-back', 'click',  openHistory);
  el('replay-first',    'click',  () => replayGoTo(0));
  el('replay-prev',     'click',  () => replayGoTo(replayIndex - 1));
  el('replay-next',     'click',  () => replayGoTo(replayIndex + 1));
  el('replay-last',     'click',  () => replayGoTo(replayMoves.length));
  el('replay-play',     'click',  toggleReplayAuto);
  el('replay-slider',   'input',  e => replayGoTo(parseInt(e.target.value)));
}

/* =====================================================
   NAVEGAÇÃO
===================================================== */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById('screen-' + name);
  if (t) t.classList.add('active');
}
function showModal(id) { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
function hideModal(id) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }

function goLobby() {
  gameActive  = false;
  aiThinking  = false;
  isSpectator = false;
  if (roomRef) { roomRef.off(); roomRef = null; }
  if (specRef) { specRef.off(); specRef = null; }
  engine.reset();
  selectedSq = null; legalMovesCache = [];
  const ir = document.getElementById('input-room');
  const is = document.getElementById('input-spectate');
  if (ir) ir.value = '';
  if (is) is.value = '';
  clearLobbyError();
  showScreen('lobby');
}

function showLobbyError(msg) { const e = document.getElementById('lobby-error'); if (e) e.textContent = msg; }
function clearLobbyError()   { const e = document.getElementById('lobby-error'); if (e) e.textContent = ''; }

/* =====================================================
   SALVAR JOGO
===================================================== */
async function saveGame(result) {
  if (!currentUser || currentUser.isAnonymous) return null;
  const record = {
    uid:          currentUser.uid,
    playerName:   currentUser.displayName || 'Jogador',
    opponentName: opponentNameGlobal,
    myColor,
    mode:         gameMode,
    difficulty:   gameMode === 'ai' ? selectedDiff : null,
    result,
    moves:        engine.history.join('|'),
    totalMoves:   engine.history.length,
    roomCode:     roomCode || null,
    playedAt:     Date.now(),
    game:         'dama'
  };
  try {
    const ref = await db.ref('dama_games').push(record);
    await db.ref(`users/${currentUser.uid}/dama_games/${ref.key}`).set({
      result, mode: gameMode, playedAt: record.playedAt,
      totalMoves: record.totalMoves, opponentName: opponentNameGlobal,
      difficulty: record.difficulty
    });
    return ref.key;
  } catch (e) { console.warn('Erro ao salvar jogo:', e); return null; }
}

/* =====================================================
   HISTÓRICO
===================================================== */
async function openHistory() {
  showScreen('history');
  const listEl  = document.getElementById('history-list');
  const statsEl = document.getElementById('history-stats');
  if (listEl)  listEl.innerHTML  = '<div class="history-loading">Carregando...</div>';
  if (statsEl) statsEl.innerHTML = '';

  if (!currentUser || currentUser.isAnonymous) {
    if (listEl) listEl.innerHTML = '<div class="history-empty">Faça login para ver seu histórico.</div>';
    return;
  }

  try {
    const snap = await db.ref(`users/${currentUser.uid}/dama_games`)
      .orderByChild('playedAt').limitToLast(50).once('value');
    const raw = snap.val();
    if (!raw) {
      if (listEl) listEl.innerHTML = '<div class="history-empty">Nenhuma partida ainda.<br>Jogue sua primeira partida!</div>';
      return;
    }

    const games = Object.entries(raw)
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.playedAt - a.playedAt);

    const wins   = games.filter(g => g.result === 'win').length;
    const losses = games.filter(g => ['loss','resigned'].includes(g.result)).length;
    const draws  = games.filter(g => g.result === 'draw').length;
    if (statsEl) statsEl.innerHTML = `
      <span class="stat stat-win">✓ ${wins}</span>
      <span class="stat stat-draw">= ${draws}</span>
      <span class="stat stat-loss">✗ ${losses}</span>
    `;

    if (listEl) listEl.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const resClass = { win:'result-win', loss:'result-loss', draw:'result-draw', resigned:'result-loss' }[game.result] || '';
      const resText  = { win:'Vitória ✓', loss:'Derrota ✗', draw:'Empate =', resigned:'Resignou' }[game.result] || game.result;
      const modeText = game.mode === 'ai' ? `🤖 IA (${game.difficulty || ''})` : '👥 Multiplayer';
      const date = new Date(game.playedAt).toLocaleDateString('pt-BR', {
        day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'
      });
      card.innerHTML = `
        <div class="history-card-left">
          <span class="history-result ${resClass}">${resText}</span>
          <span class="history-opponent">vs ${game.opponentName || 'Oponente'}</span>
        </div>
        <div class="history-card-center">
          <span class="history-mode">${modeText}</span>
          <span class="history-moves">${game.totalMoves || 0} jogadas</span>
        </div>
        <div class="history-card-right">
          <span class="history-date">${date}</span>
          <button class="btn btn-small btn-secondary">▶ Replay</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => loadReplay(game.id));
      if (listEl) listEl.appendChild(card);
    });
  } catch (e) {
    if (listEl) listEl.innerHTML = '<div class="history-empty">Erro ao carregar histórico.</div>';
    console.error(e);
  }
}

/* =====================================================
   REPLAY
===================================================== */
async function loadReplay(gameId) {
  showScreen('replay');
  try {
    const snap = await db.ref('dama_games/' + gameId).once('value');
    const data = snap.val();
    if (!data) { alert('Partida não encontrada.'); openHistory(); return; }

    const isWhite = data.myColor === 'w';
    const lbl = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    lbl('replay-label-bottom', isWhite ? `${data.playerName} (Brancas)` : `${data.playerName} (Pretas)`);
    lbl('replay-label-top',    isWhite ? `${data.opponentName} (Pretas)` : `${data.opponentName} (Brancas)`);
    lbl('replay-avatar-bottom', isWhite ? '⬜' : '⬛');
    lbl('replay-avatar-top',    isWhite ? '⬛' : '⬜');

    replayMoves  = data.moves ? data.moves.split('|').filter(Boolean) : [];
    replayIndex  = 0;
    replayEngine = new DamaEngine();

    const slider = document.getElementById('replay-slider');
    if (slider) { slider.max = replayMoves.length; slider.value = 0; }

    buildReplayBoard();
    replayRenderBoard();
    renderReplayHistory();
    updateReplayCounter();

    const resultMap = { win:'Vitória', loss:'Derrota', draw:'Empate', resigned:'Resignou' };
    lbl('replay-status', `Replay — ${resultMap[data.result] || ''} — ${replayMoves.length} jogadas`);
  } catch (e) {
    console.error(e); alert('Erro ao carregar replay.'); openHistory();
  }
}

function buildReplayBoard() {
  const boardEl = document.getElementById('replay-board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.row = row; sq.dataset.col = col;
      boardEl.appendChild(sq);
    }
  }
}

function replayGoTo(targetIndex) {
  stopReplayAuto();
  targetIndex  = Math.max(0, Math.min(replayMoves.length, targetIndex));
  replayEngine = new DamaEngine();
  replayIndex  = 0;

  for (let i = 0; i < targetIndex; i++) {
    const mv = parseMoveStr(replayMoves[i]);
    if (mv && replayEngine.makeMove(mv.from, mv.to)) replayIndex++;
  }

  const slider = document.getElementById('replay-slider');
  if (slider) slider.value = replayIndex;
  updateReplayCounter();
  replayRenderBoard();
  renderReplayHistory();
}

/* =====================================================
   PARSE DE MOVIMENTO — formato algébrico "c3-b4" ou "h4xf6"
===================================================== */
function parseMoveStr(str) {
  if (!str) return null;
  const FILES = 'abcdefgh';
  const RANKS = '87654321';
  const sep   = str.includes('x') ? 'x' : '-';
  const parts = str.split(sep);
  if (parts.length < 2) return null;

  const parseCoord = coord => {
    if (!coord || coord.length < 2) return null;
    const c = FILES.indexOf(coord[0]);
    const r = RANKS.indexOf(coord[1]);
    return (c === -1 || r === -1) ? null : [r, c];
  };

  const from = parseCoord(parts[0]);
  const to   = parseCoord(parts[1]);
  if (!from || !to) return null;
  return { from, to };
}

/* =====================================================
   REPLAY — navega para um índice SEM cancelar o auto-play
===================================================== */
function replayApplyUpTo(targetIndex) {
  targetIndex  = Math.max(0, Math.min(replayMoves.length, targetIndex));
  replayEngine = new DamaEngine();
  replayIndex  = 0;

  for (let i = 0; i < targetIndex; i++) {
    const mv = parseMoveStr(replayMoves[i]);
    if (mv && replayEngine.makeMove(mv.from, mv.to)) replayIndex++;
  }

  const slider = document.getElementById('replay-slider');
  if (slider) slider.value = replayIndex;
  updateReplayCounter();
  replayRenderBoard();
  renderReplayHistory();
}

/* =====================================================
   REPLAY — navega manualmente (para o auto-play)
===================================================== */
function replayGoTo(targetIndex) {
  stopReplayAuto();          // só cancela no clique manual
  replayApplyUpTo(targetIndex);
}

/* =====================================================
   AUTO-PLAY — avança 1 jogada por segundo sem cancelar
===================================================== */
function toggleReplayAuto() {
  if (replayInterval) {
    stopReplayAuto();
    return;
  }
  const btn = document.getElementById('replay-play');
  if (btn) btn.textContent = '⏸ Pausar';

  replayInterval = setInterval(() => {
    if (replayIndex >= replayMoves.length) {
      stopReplayAuto();
      return;
    }
    replayApplyUpTo(replayIndex + 1);   // usa a versão que NÃO cancela o interval
  }, 1000);
}

function stopReplayAuto() {
  if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
  const btn = document.getElementById('replay-play');
  if (btn) btn.textContent = '▶ Play';
}

function replayRenderBoard() {
  const boardEl = document.getElementById('replay-board');
  if (!boardEl) return;
  boardEl.querySelectorAll('.square').forEach(sq => {
    const r = parseInt(sq.dataset.row);
    const c = parseInt(sq.dataset.col);
    sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
    sq.innerHTML = '';

    if (replayEngine.lastMove) {
      const [fr, fc] = replayEngine.lastMove.from;
      const [tr, tc] = replayEngine.lastMove.to;
      if ((r===fr && c===fc) || (r===tr && c===tc)) sq.classList.add('last-move');
    }

    const piece = replayEngine.piece(r, c);
    if (piece) sq.appendChild(createPieceEl(piece));
  });
}

function renderReplayHistory() {
  const box = document.getElementById('replay-move-history');
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < replayMoves.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num'; num.textContent = (Math.floor(i/2)+1) + '.';
    const w = document.createElement('span');
    w.className = 'move-san' + (replayIndex === i+1 ? ' move-active' : '');
    w.textContent = replayMoves[i] || ''; w.style.cursor = 'pointer';
    w.addEventListener('click', () => replayGoTo(i+1));
    const b = document.createElement('span');
    b.className = 'move-san' + (replayIndex === i+2 ? ' move-active' : '');
    b.textContent = replayMoves[i+1] || '';
    if (replayMoves[i+1]) { b.style.cursor = 'pointer'; b.addEventListener('click', () => replayGoTo(i+2)); }
    row.appendChild(num); row.appendChild(w); row.appendChild(b);
    box.appendChild(row);
  }
  const active = box.querySelector('.move-active');
  if (active) active.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

function updateReplayCounter() {
  const e = document.getElementById('replay-move-counter');
  if (e) e.textContent = `Jogada ${replayIndex} de ${replayMoves.length}`;
}

/* =====================================================
   ESPECTADOR
===================================================== */
async function spectateGame() {
  const input = document.getElementById('input-spectate');
  const code  = input ? input.value.trim().toUpperCase() : '';
  clearLobbyError();
  if (code.length !== 6) { showLobbyError('Código deve ter 6 caracteres.'); return; }

  try {
    const snap = await db.ref('dama_rooms/' + code).once('value');
    const data = snap.val();
    if (!data)                     { showLobbyError('Sala não encontrada.'); return; }
    if (data.status === 'waiting') { showLobbyError('Partida ainda não começou.'); return; }
    if (['finished','resigned'].includes(data.status)) { showLobbyError('Partida já encerrou.'); return; }

    isSpectator = true; roomCode = code; myColor = 'w';
    engine.deserialize(data.state);

    const lbl = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    lbl('label-top',     data.blackName || 'Pretas');
    lbl('label-bottom',  data.whiteName || 'Brancas');
    lbl('avatar-top',    '⬛');
    lbl('avatar-bottom', '⬜');

    buildBoard(); renderGame(); showScreen('game');

    const hide = id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); };
    const show = id => { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); };
    hide('btn-resign'); hide('btn-new-game');
    show('btn-back-lobby'); show('spectator-bar');
    lbl('status-bar', `👁 Assistindo — sala ${code}`);

    specRef = db.ref('dama_rooms/' + code);
    specRef.on('value', snap => {
      const d = snap.val(); if (!d) return;
      engine.deserialize(d.state); renderGame();
      const turn = d.state?.turn === 'w' ? 'Brancas' : 'Pretas';
      lbl('status-bar', `👁 ${turn} jogam — sala ${code}`);
      if (['finished','resigned','abandoned'].includes(d.status)) {
        lbl('status-bar', '👁 Partida encerrada'); specRef.off();
      }
    });
  } catch (e) { showLobbyError('Erro ao conectar: ' + e.message); }
}

/* =====================================================
   CRIAR PARTIDA
===================================================== */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createGame() {
  const btn = document.getElementById('btn-create');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }
  clearLobbyError();
  try {
    roomCode = generateRoomCode(); myColor = 'w'; engine.reset();
    roomRef  = db.ref('dama_rooms/' + roomCode);
    const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jogador';

    await roomRef.set({
      white: myId, whiteName: myName, black: null, blackName: null,
      state: engine.serialize(), createdAt: Date.now(), status: 'waiting'
    });

    setTimeout(() => {
      if (!roomRef) return;
      roomRef.once('value', snap => {
        if (snap.val()?.status === 'waiting') { roomRef.remove(); goLobby(); }
      });
    }, 600000);

    const drc = document.getElementById('display-room-code');
    if (drc) drc.textContent = roomCode;
    showScreen('waiting');

    roomRef.on('value', snap => {
      const data = snap.val(); if (!data) return;
      if (data.black && data.status === 'playing') {
        roomRef.off();
        opponentNameGlobal = data.blackName || 'Oponente';
        startMultiplayerGame(myName, opponentNameGlobal);
      }
    });
  } catch (e) { showLobbyError('Erro ao criar sala: ' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Criar Partida'; } }
}

/* =====================================================
   ENTRAR NA PARTIDA
===================================================== */
async function joinGame() {
  const input = document.getElementById('input-room');
  const code  = input ? input.value.trim().toUpperCase() : '';
  clearLobbyError();
  if (code.length !== 6) { showLobbyError('Código deve ter 6 caracteres.'); return; }

  const btn = document.getElementById('btn-join');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  try {
    roomRef = db.ref('dama_rooms/' + code);
    const snap = await roomRef.once('value');
    const data = snap.val();
    if (!data)                                          { showLobbyError('Sala não encontrada.');  roomRef=null; return; }
    if (data.black)                                     { showLobbyError('Sala já está cheia.');   roomRef=null; return; }
    if (['finished','resigned'].includes(data.status)) { showLobbyError('Partida já encerrada.'); roomRef=null; return; }

    roomCode = code; myColor = 'b'; engine.deserialize(data.state);
    const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jogador';
    await roomRef.update({ black: myId, blackName: myName, status: 'playing' });

    opponentNameGlobal = data.whiteName || 'Oponente';
    startMultiplayerGame(myName, opponentNameGlobal);
  } catch (e) { showLobbyError('Erro ao entrar: ' + e.message); roomRef = null; }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } }
}

async function cancelGame() {
  if (roomRef) { await roomRef.remove().catch(()=>{}); roomRef.off(); roomRef = null; }
  goLobby();
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    const fb = document.getElementById('copy-feedback');
    if (fb) { fb.textContent = 'Copiado!'; setTimeout(() => { fb.textContent = ''; }, 2000); }
  });
}

/* =====================================================
   HELPER — CARD DE JOGADOR
===================================================== */
function setPlayerCard(avatarId, labelId, label, photoURL, symbol) {
  const avatarEl = document.getElementById(avatarId);
  const labelEl  = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = label;
  if (!avatarEl) return;
  if (photoURL) {
    avatarEl.innerHTML = `<img src="${photoURL}" alt="${label}"
      style="width:100%;height:100%;object-fit:cover;border-radius:6px;"
      onerror="this.parentElement.innerHTML='${symbol}'" />`;
  } else {
    avatarEl.textContent = symbol;
  }
}

/* =====================================================
   INICIAR MULTIPLAYER
===================================================== */
function startMultiplayerGame(myName, oppName) {
  gameMode = 'multiplayer'; gameActive = true; isSpectator = false;
  selectedSq = null; legalMovesCache = [];

  const myPhoto   = window._myPhotoURL || null;
  const mySymbol  = myColor === 'w' ? '⬜' : '⬛';
  const oppSymbol = myColor === 'w' ? '⬛' : '⬜';

  setPlayerCard('avatar-bottom', 'label-bottom',
    `${myName} (${myColor === 'w' ? 'Brancas' : 'Pretas'})`, myPhoto, mySymbol);
  setPlayerCard('avatar-top', 'label-top',
    `${oppName} (${myColor === 'w' ? 'Pretas' : 'Brancas'})`, null, oppSymbol);

  buildBoard(); renderGame(); showScreen('game');

  const show = id => { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); };
  const hide = id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); };
  show('btn-resign'); hide('btn-new-game'); hide('btn-back-lobby'); hide('spectator-bar');

  roomRef.on('value', snap => {
    const data = snap.val(); if (!data) return;

    if (data.status === 'resigned' && data.winner !== myColor) {
      engine.deserialize(data.state); renderGame(); gameActive = false;
      saveGame('win'); showGameOver('Vitória! 🏆', 'O oponente resignou.'); return;
    }
    if (data.status === 'abandoned') {
      gameActive = false; saveGame('win');
      showGameOver('Vitória! 🏆', 'O oponente abandonou.'); return;
    }
    if (data.state && data.state.turn === myColor) {
      engine.deserialize(data.state); renderGame();
      if (engine.status === 'finished') {
        if (engine.winner === myColor) {
          gameActive = false; saveGame('loss');
          showGameOver('Você perdeu!', 'O oponente capturou todas suas peças.');
        }
      }
    }
  });
}

/* =====================================================
   MODO VS IA
===================================================== */
function startAIGame() {
  gameMode = 'ai';
  let playerColor = selectedPlayerColor;
  if (playerColor === 'random') playerColor = Math.random() < 0.5 ? 'w' : 'b';
  myColor = playerColor; aiColor = playerColor === 'w' ? 'b' : 'w';

  ai.setDifficulty(selectedDiff);
  engine.reset();
  gameActive = true; isSpectator = false;
  selectedSq = null; legalMovesCache = [];
  opponentNameGlobal = `IA (${selectedDiff})`;

  const diffLabels = {
    iniciante:'Iniciante', intermediario:'Intermediário',
    avancado:'Avançado', expert:'Expert'
  };

  const myPhoto  = window._myPhotoURL || null;
  const mySymbol = myColor === 'w' ? '⬜' : '⬛';

  setPlayerCard('avatar-bottom', 'label-bottom',
    `Você (${myColor === 'w' ? 'Brancas' : 'Pretas'})`, myPhoto, mySymbol);
  setPlayerCard('avatar-top', 'label-top',
    `IA — ${diffLabels[selectedDiff]}`, null, '🤖');

  buildBoard(); renderGame(); showScreen('game');

  const show = id => { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); };
  const hide = id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); };
  show('btn-resign'); hide('btn-new-game'); hide('btn-back-lobby'); hide('spectator-bar');

  if (engine.turn === aiColor) scheduleAIMove();
}

function scheduleAIMove() {
  if (!gameActive || engine.turn !== aiColor) return;
  aiThinking = true; updateStatusBar();
  const delay = selectedDiff === 'expert' ? 900 : 500;

  setTimeout(() => {
    if (!gameActive) return;
    const move = ai.getBestMove(engine);
    aiThinking = false;

    if (move) {
      engine.makeMove(move.from, move.to);
      selectedSq = null; legalMovesCache = []; renderGame();

      if (engine.status === 'finished') {
        gameActive = false;
        if (engine.winner === myColor) {
          saveGame('win'); showGameOver('Vitória! 🏆', 'Você venceu! Parabéns!');
        } else {
          saveGame('loss'); showGameOver('Você perdeu!', 'A IA venceu. Tente novamente!');
        }
      }
    }
  }, delay);
}

/* =====================================================
   TABULEIRO — CONSTRUÇÃO
===================================================== */
function buildBoard() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const vr = myColor === 'w' ? row : 7 - row;
      const vc = myColor === 'w' ? col : 7 - col;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.row = vr;
      sq.dataset.col = vc;
      if (!isSpectator) sq.addEventListener('click', onSquareClick);
      boardEl.appendChild(sq);
    }
  }
}

/* =====================================================
   CRIAR ELEMENTO DE PEÇA — classes corretas do CSS
===================================================== */
function createPieceEl(piece) {
  const div = document.createElement('div');
  div.className = 'dama-piece ' +
    (piece.color === 'w' ? 'piece-branca' : 'piece-preta') +
    (piece.king ? ' piece-king' : '');
  if (piece.king) {
    const crown = document.createElement('span');
    crown.className = 'king-crown';
    crown.textContent = '♛';
    div.appendChild(crown);
  }
  return div;
}


/* =====================================================
   RENDERIZAÇÃO
===================================================== */
function renderGame() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  boardEl.querySelectorAll('.square').forEach(sq => {
    const vr = parseInt(sq.dataset.row);
    const vc = parseInt(sq.dataset.col);
    const [lr, lc] = viewToLogic(vr, vc);
    const isLight = (vr + vc) % 2 === 0;

    sq.className = 'square ' + (isLight ? 'light' : 'dark');
    sq.innerHTML = '';

    // Destaque último movimento
    if (engine.lastMove) {
      const [fvr, fvc] = logicToView(...engine.lastMove.from);
      const [tvr, tvc] = logicToView(...engine.lastMove.to);
      if ((vr===fvr && vc===fvc)||(vr===tvr && vc===tvc))
        sq.classList.add('last-move');
    }

    const piece = engine.piece(lr, lc);
    if (piece) {
      const div = document.createElement('div');
      div.className = 'dama-piece ' +
        (piece.color === 'w' ? 'piece-branca' : 'piece-preta') +
        (piece.king ? ' piece-king' : '');
      if (piece.king) {
        const crown = document.createElement('span');
        crown.className = 'king-crown';
        crown.textContent = '♛';
        div.appendChild(crown);
      }
      sq.appendChild(div);
    }
  });

  // Destaques de seleção e movimentos legais
  if (selectedSq !== null) {
    const [slr, slc] = selectedSq;
    const [svr, svc] = logicToView(slr, slc);
    const sel = boardEl.querySelector(`[data-row="${svr}"][data-col="${svc}"]`);
    if (sel) sel.classList.add('selected');

    legalMovesCache.forEach(m => {
      const [mvr, mvc] = logicToView(m.to[0], m.to[1]);
      const el = boardEl.querySelector(`[data-row="${mvr}"][data-col="${mvc}"]`);
      if (el) el.classList.add(m.captures.length ? 'capture-hint' : 'move-hint');
    });
  }

  updateStatusBar();
  updateMoveHistory();
  updatePieceCount();
  updateTurnCards();
}

/* =====================================================
   CONTAGEM DE PEÇAS — atualiza cards em tempo real
===================================================== */
function updatePieceCount() {
  const wCount = engine.countPieces('w');
  const bCount = engine.countPieces('b');

  const wKings = countKings('w');
  const bKings = countKings('b');

  const fmt = (count, kings, symbol) => {
    const k = kings > 0 ? ` (${kings} ♛)` : '';
    return `${symbol} ${count} peça${count !== 1 ? 's' : ''}${k}`;
  };

  /* card-bottom = meu lado, card-top = oponente */
  const myCount  = myColor === 'w' ? wCount : bCount;
  const oppCount = myColor === 'w' ? bCount : wCount;
  const myKings  = myColor === 'w' ? wKings : bKings;
  const oppKings = myColor === 'w' ? bKings : wKings;
  const mySymbol  = myColor === 'w' ? '⬜' : '⬛';
  const oppSymbol = myColor === 'w' ? '⬛' : '⬜';

  const cb = document.getElementById('count-bottom');
  const ct = document.getElementById('count-top');
  if (cb) cb.textContent = fmt(myCount,  myKings,  mySymbol);
  if (ct) ct.textContent = fmt(oppCount, oppKings, oppSymbol);

  /* Remove peça-count genérica se ainda existir */
  const old = document.getElementById('piece-count');
  if (old) old.remove();
}

function countKings(color) {
  let k = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (engine.board[r][c]?.color === color && engine.board[r][c]?.king) k++;
  return k;
}

/* =====================================================
   CLIQUE
===================================================== */
function onSquareClick(e) {
  const sq = e.currentTarget;
  const r  = parseInt(sq.dataset.row);
  const c  = parseInt(sq.dataset.col);

  if (!gameActive || isSpectator || aiThinking) return;
  if (engine.turn !== myColor) return;
  if (engine.status === 'finished') return;

  /* Se há uma cadeia de captura em andamento */
  if (engine.chainPiece) {
    const [cr, cc] = engine.chainPiece;
    const move = legalMovesCache.find(m => m.to[0]===r && m.to[1]===c);
    if (move) { doMove(move); return; }
    return; /* durante cadeia só pode mover a peça da cadeia */
  }

  const piece = engine.piece(r, c);

  if (selectedSq !== null) {
    const move = legalMovesCache.find(m => m.to[0]===r && m.to[1]===c);
    if (move) { doMove(move); return; }
    if (piece && piece.color === myColor) {
      selectedSq = [r, c];
      legalMovesCache = engine.legalMoves(r, c);
      renderGame(); return;
    }
    selectedSq = null; legalMovesCache = []; renderGame(); return;
  }

  if (piece && piece.color === myColor) {
    selectedSq = [r, c];
    legalMovesCache = engine.legalMoves(r, c);
    /* Força captura: se existem capturas, filtra apenas capturas */
    const allCaptures = engine.allLegalMovesForColor(myColor).filter(m => m.captured);
    if (allCaptures.length > 0) {
      legalMovesCache = legalMovesCache.filter(m => m.captured);
    }
    renderGame();
  }
}

/* =====================================================
   EXECUTAR MOVIMENTO
===================================================== */
async function doMove(move) {
  const ok = engine.makeMove(move.from, move.to);
  if (!ok) return;

  /* Grava SAN simples: "from-to" */
  const san = `${move.from[0]},${move.from[1]}-${move.to[0]},${move.to[1]}`;
  selectedSq = null;

  /* Durante cadeia de captura mantém a peça selecionada */
  if (engine.chainPiece) {
    selectedSq = [...engine.chainPiece];
    legalMovesCache = engine.legalMoves(selectedSq[0], selectedSq[1]);
  } else {
    legalMovesCache = [];
  }

  renderGame();

  if (gameMode === 'multiplayer' && roomRef) {
    try { await roomRef.update({ state: engine.serialize() }); }
    catch (ex) { console.error('Erro ao salvar movimento:', ex); }
  }

  if (engine.status === 'finished') {
    if (gameMode === 'multiplayer' && roomRef)
      await roomRef.update({ status:'finished', winner: engine.winner }).catch(()=>{});

    gameActive = false;
    if (engine.winner === myColor) {
      saveGame('win'); showGameOver('Vitória! 🏆', 'Você capturou todas as peças!');
    } else {
      saveGame('loss'); showGameOver('Você perdeu!', 'O oponente capturou todas suas peças.');
    }
    return;
  }

  if (gameMode === 'ai' && engine.turn === aiColor && !engine.chainPiece) {
    scheduleAIMove();
  }
}

/* =====================================================
   STATUS BAR
===================================================== */
function updateStatusBar() {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  bar.className = 'status-bar';

  if (isSpectator) {
    bar.textContent = `👁 Assistindo — ${engine.turn === 'w' ? 'Brancas' : 'Pretas'} jogam`;
    return;
  }
  if (aiThinking) {
    bar.innerHTML = 'IA pensando <span class="thinking-dots"><span></span><span></span><span></span></span>';
    return;
  }
  if (engine.chainPiece) {
    bar.textContent = '⚡ Continue capturando!';
    bar.classList.add('your-turn');
    return;
  }

  const isMyTurn = engine.turn === myColor;
  if (engine.status === 'finished') {
    bar.textContent = engine.winner === myColor ? '🏆 Vitória!' : '💀 Derrota';
    return;
  }
  bar.textContent = isMyTurn ? 'Sua vez' : (gameMode==='ai' ? 'IA pensando...' : 'Vez do oponente');
  if (isMyTurn) bar.classList.add('your-turn');
}

/* =====================================================
   HISTÓRICO DE MOVIMENTOS (em jogo)
===================================================== */
function updateMoveHistory() {
  const box = document.getElementById('move-history');
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < engine.history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span'); num.className = 'move-num'; num.textContent = (Math.floor(i/2)+1) + '.';
    const w = document.createElement('span'); w.className = 'move-san'; w.textContent = engine.history[i] || '';
    const b = document.createElement('span'); b.className = 'move-san'; b.textContent = engine.history[i+1] || '';
    row.appendChild(num); row.appendChild(w); row.appendChild(b);
    box.appendChild(row);
  }
  box.scrollTop = box.scrollHeight;
}

/* =====================================================
   CONTAGEM DE PEÇAS CAPTURADAS
===================================================== */
function updateCaptureCount() {
  const counts = engine.countPieces();

  const myPieces  = myColor === 'w' ? counts.w : counts.b;
  const oppPieces = myColor === 'w' ? counts.b : counts.w;
  const myKings   = myColor === 'w' ? counts.wK : counts.bK;
  const oppKings  = myColor === 'w' ? counts.bK : counts.wK;

  const myEl  = document.getElementById('my-count');
  const oppEl = document.getElementById('opp-count');

  const fmt = (total, kings, symbol) =>
    `${symbol} ${total} peça${total !== 1 ? 's' : ''}${kings > 0 ? ` (${kings} ♛)` : ''}`;

  if (myEl)  myEl.textContent  = fmt(myPieces,  myKings,  myColor  === 'w' ? '⬜' : '⬛');
  if (oppEl) oppEl.textContent = fmt(oppPieces, oppKings, myColor  === 'w' ? '⬛' : '⬜');
}

/* =====================================================
   CARDS DE TURNO
===================================================== */
function updateTurnCards() {
  const isMyTurn = engine.turn === myColor;
  const cb = document.getElementById('card-bottom');
  const ct = document.getElementById('card-top');
  if (cb) cb.classList.toggle('active-turn',  isMyTurn);
  if (ct) ct.classList.toggle('active-turn', !isMyTurn);
}

/* =====================================================
   RESIGNAR
===================================================== */
async function resign() {
  if (!gameActive || isSpectator) return;
  if (!confirm('Tem certeza que deseja resignar?')) return;
  gameActive = false;
  if (gameMode === 'multiplayer' && roomRef) {
    const enemy = myColor === 'w' ? 'b' : 'w';
    await roomRef.update({ status:'resigned', winner:enemy, state:engine.serialize() }).catch(()=>{});
  }
  saveGame('resigned');
  showGameOver('Você resignou', gameMode==='ai' ? 'A IA venceu.' : 'O oponente venceu.');
}

/* =====================================================
   GAME OVER
===================================================== */
function showGameOver(title, msg) {
  const t = document.getElementById('gameover-title');
  const m = document.getElementById('gameover-msg');
  const i = document.getElementById('gameover-icon');
  if (t) t.textContent = title;
  if (m) m.textContent = msg;
  if (i) i.textContent = title.includes('🏆') ? '🏆'
    : title.includes('perdeu') ? '💀'
    : title.includes('resignou') ? '🏳' : '⬛';

  const hide = id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); };
  const show = id => { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); };
  hide('btn-resign'); show('btn-new-game');
  setTimeout(() => showModal('modal-gameover'), 700);
}

/* =====================================================
   CONVERSÃO VIEW ↔ LÓGICA
   Brancas: view = lógica (normal)
   Pretas:  tabuleiro invertido
===================================================== */
function viewToLogic(vr, vc) {
  return myColor === 'w' ? [vr, vc] : [7 - vr, 7 - vc];
}

function logicToView(lr, lc) {
  return myColor === 'w' ? [lr, lc] : [7 - lr, 7 - lc];
}