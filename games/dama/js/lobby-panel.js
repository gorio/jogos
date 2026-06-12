function setLobbyStatus(msg) {
  const e = document.getElementById('lobby-status');
  if (e) e.textContent = msg;
}

function showLobbyError(msg) {
  const e = document.getElementById('lobby-error');
  if (e) e.textContent = msg;
}

function clearLobbyError() {
  showLobbyError('');
}

function injectDamaLobbyPanelFixes() {
  if (document.getElementById('dama-lobby-panel-fixes')) return;
  const style = document.createElement('style');
  style.id = 'dama-lobby-panel-fixes';
  style.textContent = `
    .status-card .mode-selector {
      width: 100% !important;
      max-width: 100% !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      overflow: hidden !important;
    }
    .status-card .mode-btn {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
      align-content: start !important;
      justify-items: start !important;
      text-align: left !important;
      outline: 0 !important;
      grid-template-rows: auto auto !important;
    }
    .status-card .mode-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(233,180,76,0.42) !important;
    }
    .status-card .mode-label {
      width: 100% !important;
      min-width: 0 !important;
      text-align: left !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .status-card .mode-btn .mode-desc {
      width: 100% !important;
      min-width: 0 !important;
      text-align: left !important;
      overflow-wrap: normal !important;
    }
    .status-card .mode-panel,
    .status-card .ai-options,
    .status-card .option-group,
    .status-card .color-selector,
    .status-card .difficulty-selector {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }
    .status-card .mode-panel,
    .status-card .ai-options {
      overflow: hidden !important;
    }
    .status-card .difficulty-selector {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }
    .status-card .color-btn,
    .status-card .diff-btn {
      min-width: 0 !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

function showRoomInvite(code) {
  const createBtn = document.getElementById('btn-create');
  const joinRow = document.getElementById('join-room-row');
  const codeBox = document.getElementById('current-room-code');
  const inviteBtn = document.getElementById('btn-invite-room');
  const hasCode = Boolean(code);

  if (codeBox) {
    codeBox.textContent = hasCode ? 'Sala ' + code : '';
    codeBox.classList.toggle('active', hasCode);
  }
  if (createBtn) createBtn.classList.toggle('hidden', hasCode);
  if (joinRow) joinRow.classList.toggle('hidden', hasCode);
  if (inviteBtn) inviteBtn.classList.toggle('hidden', !hasCode);
}

async function inviteRoom() {
  if (!roomCode) {
    showLobbyError('Crie uma sala primeiro.');
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  const text = 'Te desafio para uma partida de Dama. Código: ' + roomCode + ' - ' + url.toString();

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Desafio de Dama', text, url: url.toString() });
      return;
    }
    await navigator.clipboard.writeText(text);
    showLobbyError('Convite copiado. Envie para o outro jogador.');
  } catch (e) {
    showLobbyError('Código da sala: ' + roomCode);
  }
}

initLobbyUI = function() {
  injectDamaLobbyPanelFixes();
  el('btn-logout', 'click', () => fbAuth.signOut());
  el('btn-history', 'click', openHistory);
  el('btn-create', 'click', createGame);
  el('btn-join', 'click', joinGame);
  el('btn-invite-room', 'click', inviteRoom);
  el('btn-start-ai', 'click', startAIGame);
  el('input-room', 'keydown', e => { if (e.key === 'Enter') joinGame(); });
  el('input-room', 'input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  const requestedRoom = new URLSearchParams(window.location.search).get('room');
  const roomInput = document.getElementById('input-room');
  if (requestedRoom && roomInput) {
    roomInput.value = requestedRoom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

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
};

goLobby = function() {
  gameActive = false;
  aiThinking = false;
  isSpectator = false;
  if (roomRef) { roomRef.off(); roomRef = null; }
  if (specRef) { specRef.off(); specRef = null; }
  engine.reset();
  selectedSq = null;
  legalMovesCache = [];
  roomCode = null;
  const ir = document.getElementById('input-room');
  if (ir) ir.value = '';
  showRoomInvite('');
  setLobbyStatus('Crie ou entre em uma sala');
  clearLobbyError();
  showScreen('lobby');
};

createGame = async function() {
  const btn = document.getElementById('btn-create');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }
  clearLobbyError();
  setLobbyStatus('Criando sala...');

  try {
    roomCode = generateRoomCode();
    myColor = 'w';
    engine.reset();
    roomRef = db.ref('dama_rooms/' + roomCode);
    const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jogador';

    await roomRef.set({
      white: myId,
      whiteName: myName,
      black: null,
      blackName: null,
      state: engine.serialize(),
      createdAt: Date.now(),
      status: 'waiting'
    });

    setTimeout(() => {
      if (!roomRef) return;
      roomRef.once('value', snap => {
        if (snap.val()?.status === 'waiting') {
          roomRef.remove();
          goLobby();
        }
      });
    }, 600000);

    showRoomInvite(roomCode);
    setLobbyStatus('Aguardando adversário');
    showLobbyError('Compartilhe o código ou envie o convite para outro jogador.');

    roomRef.on('value', snap => {
      const data = snap.val();
      if (!data) return;
      if (data.black && data.status === 'playing') {
        roomRef.off();
        opponentNameGlobal = data.blackName || 'Oponente';
        startMultiplayerGame(myName, opponentNameGlobal);
      }
    });
  } catch (e) {
    showLobbyError('Erro ao criar sala: ' + e.message);
    setLobbyStatus('Crie ou entre em uma sala');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Criar sala online'; }
  }
};

joinGame = async function() {
  const input = document.getElementById('input-room');
  const code = input ? input.value.trim().toUpperCase() : '';
  clearLobbyError();
  if (code.length !== 6) {
    showLobbyError('Código deve ter 6 caracteres.');
    return;
  }

  setLobbyStatus('Entrando na sala...');
  const btn = document.getElementById('btn-join');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  try {
    roomRef = db.ref('dama_rooms/' + code);
    const snap = await roomRef.once('value');
    const data = snap.val();
    if (!data) {
      showLobbyError('Sala não encontrada.');
      setLobbyStatus('Crie ou entre em uma sala');
      roomRef = null;
      return;
    }
    if (data.black) {
      showLobbyError('Sala já está cheia.');
      setLobbyStatus('Crie ou entre em uma sala');
      roomRef = null;
      return;
    }
    if (['finished', 'resigned'].includes(data.status)) {
      showLobbyError('Partida já encerrada.');
      setLobbyStatus('Crie ou entre em uma sala');
      roomRef = null;
      return;
    }

    roomCode = code;
    myColor = 'b';
    engine.deserialize(data.state);
    const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Jogador';
    await roomRef.update({ black: myId, blackName: myName, status: 'playing' });

    opponentNameGlobal = data.whiteName || 'Oponente';
    startMultiplayerGame(myName, opponentNameGlobal);
  } catch (e) {
    showLobbyError('Erro ao entrar: ' + e.message);
    setLobbyStatus('Crie ou entre em uma sala');
    roomRef = null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
};
