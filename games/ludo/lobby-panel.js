function setLobbyStatus(msg) {
  const e = gel('lobby-status');
  if (e) e.textContent = msg;
}

function showRoomInvite(code) {
  const createBtn = gel('btn-create-room');
  const joinRow = gel('join-room-row');
  const countGroup = gel('lobby-player-count-group');
  const codeBox = gel('current-room-code');
  const inviteBtn = gel('btn-invite-room');
  const startBtn = gel('btn-start-room-lobby');
  const cancelBtn = gel('btn-cancel-room-lobby');
  const hasCode = Boolean(code);

  if (codeBox) {
    codeBox.textContent = hasCode ? 'Sala ' + code : '';
    codeBox.classList.toggle('active', hasCode);
  }
  if (createBtn) createBtn.classList.toggle('hidden', hasCode);
  if (joinRow) joinRow.classList.toggle('hidden', hasCode);
  if (countGroup) countGroup.classList.toggle('hidden', hasCode);
  if (inviteBtn) inviteBtn.classList.toggle('hidden', !hasCode);
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !hasCode);
  if (startBtn) startBtn.classList.add('hidden');
}

async function inviteRoom() {
  if (!roomCode) {
    showLobbyError('Crie uma sala primeiro.');
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  const text = 'Te desafio para uma partida de Ludo. Código: ' + roomCode + ' - ' + url.toString();

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Desafio de Ludo', text, url: url.toString() });
      return;
    }
    await navigator.clipboard.writeText(text);
    showLobbyError('Convite copiado. Envie para os outros jogadores.');
  } catch (e) {
    showLobbyError('Código da sala: ' + roomCode);
  }
}

function updateLobbyWaitingRoom(room) {
  const playerColors = room.playerColors || {};
  const slots = window.LUDO_CONSTANTS.LUDO_COLORS
    .map(color => playerFromSlot(color, playerColors[color] || emptySlot(color)));
  const humanCount = slots.filter(player => player.id && !player.isAI).length;
  const expected = room.expectedHumanPlayers || 2;
  const isHost = room.hostUid === currentAuthManager.uid;
  const startBtn = gel('btn-start-room-lobby');

  setLobbyStatus('Aguardando jogadores');
  showRoomInvite(room.roomCode || roomCode);
  showLobbyError(humanCount + ' / ' + expected + ' jogadores na sala' + (isHost ? '. Inicie quando todos entrarem.' : '. Aguardando o anfitrião iniciar.'));

  if (startBtn) {
    startBtn.classList.toggle('hidden', !isHost);
    startBtn.disabled = !isHost || humanCount < expected;
  }
}

initLobbyUI = function() {
  el('btn-logout', 'click', function() { currentAuthManager.signOut(); });
  el('btn-history-ludo', 'click', openHistoryScreen);
  el('btn-create-room', 'click', createGame);
  el('btn-join-room', 'click', joinGame);
  el('btn-invite-room', 'click', inviteRoom);
  el('btn-start-room-lobby', 'click', startGameAsHost);
  el('btn-cancel-room-lobby', 'click', cancelGame);
  el('btn-start-ai-game', 'click', startAIGame);
  el('input-room', 'keydown', event => { if (event.key === 'Enter') joinGame(); });
  el('input-room', 'input', event => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  const requestedRoom = new URLSearchParams(window.location.search).get('room');
  const roomInput = gel('input-room');
  if (requestedRoom && roomInput) {
    roomInput.value = requestedRoom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.mode;
      gel('panel-multiplayer').classList.toggle('hidden', gameMode !== 'multiplayer');
      gel('panel-ai').classList.toggle('hidden', gameMode !== 'ai');
      clearLobbyError();
    });
  });

  document.querySelectorAll('#lobby-player-count .seg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedHumanPlayersCount = parseInt(btn.dataset.count, 10);
      setActiveSegment('#lobby-player-count .seg-btn', btn);
    });
  });

  document.querySelectorAll('#lobby-ai-count .seg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedAiCount = parseInt(btn.dataset.count, 10);
      setActiveSegment('#lobby-ai-count .seg-btn', btn);
    });
  });
};

async function createGame() {
  if (!requireUser('criar uma partida')) return;
  const btn = gel('btn-create-room');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }
  clearLobbyError();
  setLobbyStatus('Criando sala...');

  try {
    stopRoomListeners();
    roomCode = generateRoomCode();
    roomRef = db.ref('ludo_rooms/' + roomCode);
    myColor = 'red';

    const colors = window.LUDO_CONSTANTS.LUDO_COLORS.slice();
    const playerColors = {};
    colors.forEach(color => { playerColors[color] = emptySlot(color); });
    playerColors.red = {
      id: currentAuthManager.uid,
      name: safeName(currentAuthManager.displayName, 'Jogador'),
      isAI: false,
      photoURL: currentAuthManager.photoURL || ''
    };

    const aiSlots = colors.slice(selectedHumanPlayersCount);
    aiSlots.forEach(function(color, index) {
      playerColors[color] = {
        id: 'ai_' + color + '_' + Date.now() + '_' + index,
        name: 'Computador ' + (index + 1),
        isAI: true,
        photoURL: ''
      };
    });

    engine.setupGame(playersFromSlots(playerColors));
    await roomRef.set({
      roomCode: roomCode,
      gameType: 'ludo',
      hostUid: currentAuthManager.uid,
      expectedHumanPlayers: selectedHumanPlayersCount,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      status: 'waiting',
      playerColors: playerColors,
      state: engine.serialize()
    });

    text(gel('display-room-code'), roomCode);
    showRoomInvite(roomCode);
    watchWaitingRoom();
  } catch (error) {
    console.error(error);
    showLobbyError('Erro ao criar sala: ' + error.message);
    setLobbyStatus('Crie ou entre em uma sala');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Criar sala online'; }
  }
}

async function joinGame() {
  if (!requireUser('entrar em uma partida')) return;
  const code = (gel('input-room').value || '').trim().toUpperCase();
  clearLobbyError();
  if (code.length !== 6) { showLobbyError('Código deve ter 6 caracteres.'); return; }

  const btn = gel('btn-join-room');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
  setLobbyStatus('Entrando na sala...');

  try {
    stopRoomListeners();
    roomRef = db.ref('ludo_rooms/' + code);
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room) { showLobbyError('Sala não encontrada.'); setLobbyStatus('Crie ou entre em uma sala'); roomRef = null; return; }
    if (room.gameType !== 'ludo') { showLobbyError('Esta sala é de outro jogo.'); setLobbyStatus('Crie ou entre em uma sala'); roomRef = null; return; }
    if (room.status !== 'waiting') { showLobbyError('Esta partida já começou.'); setLobbyStatus('Crie ou entre em uma sala'); roomRef = null; return; }

    const playerColors = room.playerColors || {};
    let chosenColor = null;
    for (const color of window.LUDO_CONSTANTS.LUDO_COLORS) {
      const slot = playerColors[color];
      if (slot && slot.id === currentAuthManager.uid) { chosenColor = color; break; }
      if (slot && !slot.id && !slot.isAI && !chosenColor) chosenColor = color;
    }
    if (!chosenColor) { showLobbyError('Sala cheia.'); setLobbyStatus('Crie ou entre em uma sala'); roomRef = null; return; }

    myColor = chosenColor;
    roomCode = code;
    await roomRef.child('playerColors/' + chosenColor).set({
      id: currentAuthManager.uid,
      name: safeName(currentAuthManager.displayName, 'Jogador'),
      isAI: false,
      photoURL: currentAuthManager.photoURL || ''
    });

    text(gel('display-room-code'), roomCode);
    showRoomInvite(roomCode);
    watchWaitingRoom();
  } catch (error) {
    console.error(error);
    showLobbyError('Erro ao entrar: ' + error.message);
    setLobbyStatus('Crie ou entre em uma sala');
    roomRef = null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}

function watchWaitingRoom() {
  if (!roomRef) return;
  roomRef.on('value', function(snap) {
    const room = snap.val();
    if (!room) {
      stopRoomListeners();
      goLobby();
      showLobbyError('A sala foi encerrada.');
      return;
    }
    if (room.status === 'playing') {
      startMultiplayerGame(room);
      return;
    }
    updateLobbyWaitingRoom(room);
  });
}

function goLobby() {
  stopRoomListeners();
  gameActive = false;
  aiThinking = false;
  isSpectator = false;
  myColor = null;
  roomCode = null;
  if (engine) engine.reset();
  if (gel('input-room')) gel('input-room').value = '';
  showRoomInvite('');
  setLobbyStatus('Crie ou entre em uma sala');
  clearLobbyError();
  showScreen('lobby');
}
