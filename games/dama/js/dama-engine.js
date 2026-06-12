/* =====================================================
   MOTOR DE DAMA — Regras Brasileiras
   Captura obrigatória + captura máxima
===================================================== */
class DamaEngine {
  constructor() { this.reset(); }

  reset() {
    this.board        = this._initBoard();
    this.turn         = 'w';
    this.history      = [];
    this.captured     = { w: 0, b: 0 };
    this.status       = 'playing';
    this.winner       = null;
    this.lastMove     = null;
    this.chainPiece   = null;   // [r,c] peça em cadeia de captura
    this.chainSkipped = [];     // chaves 'r,c' já capturadas na cadeia
  }

  _initBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) b[r][c] = { color: 'b', king: false };
          if (r > 4) b[r][c] = { color: 'w', king: false };
        }
      }
    }
    return b;
  }

  piece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r]?.[c] || null;
  }

  /* ─── Verifica se existe ALGUMA captura disponível para uma cor ─── */
  /* SEM chamar legalMoves — evita recursão infinita */
  _hasAnyCapture(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color) continue;
        if (this._capturesFor(r, c, [], this.board).length > 0) return true;
      }
    }
    return false;
  }

  /* ─── Capturas simples (1 salto) disponíveis a partir de [r,c] ─── */
  _capturesFor(r, c, skipKeys, board) {
    const p = board[r]?.[c];
    if (!p) return [];
    const enemy   = p.color === 'w' ? 'b' : 'w';
    const dirs    = p.king
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (p.color === 'w' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const results = [];

    if (p.king) {
      // Dama: varre toda a diagonal até encontrar inimigo, depois verifica espaço livre
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        let tr = r + dr, tc = c + dc;
        let foundEnemy = null;
        while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const cell = board[tr][tc];
          if (cell) {
            if (cell.color === enemy && !skipKeys.includes(`${tr},${tc}`)) {
              foundEnemy = [tr, tc];
            } else {
              break; // bloqueado por aliado ou inimigo já capturado
            }
          }
          if (foundEnemy) {
            // Verifica se o próximo quadrado está livre
            const lr = tr + dr, lc = tc + dc;
            if (lr >= 0 && lr < 8 && lc >= 0 && lc < 8 && !board[lr][lc]) {
              results.push({ from:[r,c], over:foundEnemy, to:[lr,lc] });
              // Continua varrendo após o inimigo
              let nr = lr + dr, nc = lc + dc;
              while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
                results.push({ from:[r,c], over:foundEnemy, to:[nr,nc] });
                nr += dr; nc += dc;
              }
              foundEnemy = null;
            }
            break;
          }
          tr += dr; tc += dc;
        }
      }
    } else {
      // Peão: captura em diagonal (frente e trás para captura)
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const mr = r + dr,  mc = c + dc;   // casa do inimigo
        const lr = r + 2*dr, lc = c + 2*dc; // casa de pouso
        if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
        const mid = board[mr]?.[mc];
        if (mid && mid.color === enemy && !skipKeys.includes(`${mr},${mc}`) && !board[lr][lc]) {
          results.push({ from:[r,c], over:[mr,mc], to:[lr,lc] });
        }
      }
    }
    return results;
  }

  /* ─── Expande capturas em cadeia a partir de [r,c] ─── */
  _expandCaptures(r, c, skipKeys, board) {
    const single = this._capturesFor(r, c, skipKeys, board);
    if (single.length === 0) return [[]]; // sem mais capturas → fim da cadeia

    const chains = [];
    for (const cap of single) {
      const newSkip = [...skipKeys, `${cap.over[0]},${cap.over[1]}`];
      // Aplica o salto num tabuleiro temporário
      const nb = board.map(row => row.map(p => p ? {...p} : null));
      nb[cap.to[0]][cap.to[1]] = nb[r][c];
      nb[r][c] = null;
      // Promoção durante cadeia
      const piece = nb[cap.to[0]][cap.to[1]];
      if (piece && !piece.king) {
        if ((piece.color === 'w' && cap.to[0] === 0) ||
            (piece.color === 'b' && cap.to[0] === 7)) {
          piece.king = true;
        }
      }
      const continuations = this._expandCaptures(cap.to[0], cap.to[1], newSkip, nb);
      for (const cont of continuations) {
        chains.push([cap, ...cont]);
      }
    }
    return chains;
  }

  /* ─── Movimentos simples (sem captura) ─── */
  _simpleMoves(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];

    if (p.king) {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        let tr = r + dr, tc = c + dc;
        while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8 && !this.board[tr][tc]) {
          moves.push({ from:[r,c], to:[tr,tc], captures:[] });
          tr += dr; tc += dc;
        }
      }
    } else {
      const dirs = p.color === 'w' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
      for (const [dr, dc] of dirs) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8 && !this.board[tr][tc]) {
          moves.push({ from:[r,c], to:[tr,tc], captures:[] });
        }
      }
    }
    return moves;
  }

  /* ─── Movimentos legais de uma peça ─── */
  legalMoves(r, c) {
    const p = this.piece(r, c);
    if (!p || p.color !== this.turn) return [];

    // Se há cadeia em andamento, só essa peça pode mover
    if (this.chainPiece) {
      if (this.chainPiece[0] !== r || this.chainPiece[1] !== c) return [];
      const caps = this._capturesFor(r, c, this.chainSkipped, this.board);
      return caps.map(cap => ({ from:[r,c], to:cap.to, captures:[cap.over], chain:true }));
    }

    // Verifica se existe captura obrigatória para o jogador atual
    const mustCapture = this._hasAnyCapture(this.turn);
    if (mustCapture) {
      // Expande todas as cadeias para esta peça
      const chains  = this._expandCaptures(r, c, [], this.board);
      const hasCaps = chains.some(ch => ch.length > 0);
      if (!hasCaps) return [];

      // Regra de captura máxima: só chains com comprimento máximo
      const maxLen  = Math.max(...chains.filter(ch => ch.length > 0).map(ch => ch.length));
      const best    = chains.filter(ch => ch.length === maxLen);

      return best.map(chain => ({
        from:     [r, c],
        to:       chain[chain.length - 1].to,
        captures: chain.map(c => c.over),
        chain:    false
      }));
    }

    return this._simpleMoves(r, c);
  }

  /* ─── Todos os movimentos legais de uma cor ─── */
  allLegalMovesForColor(color) {
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === color) {
          all.push(...this.legalMoves(r, c));
        }
      }
    }
    return all;
  }

  /* ─── Executa um movimento ─── */
  makeMove(from, to, _promo) {
    const [fr, fc] = from;
    const [tr, tc] = to;
    const legal    = this.legalMoves(fr, fc);
    const move     = legal.find(m => m.to[0] === tr && m.to[1] === tc);
    if (!move) return false;

    const p = { ...this.board[fr][fc] };

    // Remove peças capturadas
    (move.captures || []).forEach(([cr, cc]) => {
      if (this.board[cr][cc]) {
        this.captured[p.color]++;
        this.board[cr][cc] = null;
      }
    });

    // Move a peça
    this.board[tr][tc] = p;
    this.board[fr][fc] = null;

    // Promoção
    if (!p.king) {
      if ((p.color === 'w' && tr === 0) || (p.color === 'b' && tr === 7)) {
        this.board[tr][tc].king = true;
      }
    }

    this.lastMove = { from, to };

    // Notação simples para histórico
    const files  = 'abcdefgh';
    const ranks  = '87654321';
    const sanStr = `${files[fc]}${ranks[fr]}${move.captures.length ? 'x' : '-'}${files[tc]}${ranks[tr]}`;
    this.history.push(sanStr);

    // Verifica se o turno termina ou continua em cadeia
    // (cadeia: ainda há capturas disponíveis a partir do destino e houve captura)
    this.chainPiece   = null;
    this.chainSkipped = [];
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Verifica game over
    this._updateStatus();
    return true;
  }

  _updateStatus() {
    const moves = this.allLegalMovesForColor(this.turn);
    if (moves.length === 0) {
      this.status = 'finished';
      this.winner = this.turn === 'w' ? 'b' : 'w';
    } else {
      this.status = 'playing';
    }

    // Sem peças = derrota
    let wCount = 0, bCount = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === 'w') wCount++;
        if (this.board[r][c]?.color === 'b') bCount++;
      }
    if (wCount === 0) { this.status = 'finished'; this.winner = 'b'; }
    if (bCount === 0) { this.status = 'finished'; this.winner = 'w'; }
  }

  countPieces(color) {
    let count = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.color === color) count++;
    return count;
  }

  serialize() {
    const boardStr = this.board
      .flat()
      .map(p => p ? `${p.color}${p.king ? 'K' : 'P'}` : '__')
      .join(',');
    return {
      boardStr,
      turn:     this.turn,
      status:   this.status,
      winner:   this.winner || '',
      history:  this.history.join('|'),
      capturedW: this.captured.w,
      capturedB: this.captured.b
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.boardStr) {
      const cells = data.boardStr.split(',');
      this.board = [];
      for (let r = 0; r < 8; r++) {
        this.board[r] = [];
        for (let c = 0; c < 8; c++) {
          const cell = cells[r * 8 + c];
          this.board[r][c] = (cell && cell !== '__')
            ? { color: cell[0], king: cell[1] === 'K' }
            : null;
        }
      }
    }
    this.turn     = data.turn    || 'w';
    this.status   = data.status  || 'playing';
    this.winner   = data.winner  || null;
    this.history  = data.history ? data.history.split('|') : [];
    this.captured = {
      w: Number(data.capturedW) || 0,
      b: Number(data.capturedB) || 0
    };
    this.chainPiece   = null;
    this.chainSkipped = [];
    this.lastMove     = null;
  }

  clone() {
    const c = new DamaEngine();
    c.board        = this.board.map(row => row.map(p => p ? {...p} : null));
    c.turn         = this.turn;
    c.status       = this.status;
    c.winner       = this.winner;
    c.history      = [...this.history];
    c.captured     = { ...this.captured };
    c.chainPiece   = this.chainPiece   ? [...this.chainPiece]   : null;
    c.chainSkipped = [...this.chainSkipped];
    c.lastMove     = this.lastMove
      ? { from:[...this.lastMove.from], to:[...this.lastMove.to] }
      : null;
    return c;
  }
}