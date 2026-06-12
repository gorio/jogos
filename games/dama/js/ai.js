/* =====================================================
   IA PARA DAMA — Minimax com Alpha-Beta Pruning
===================================================== */
class DamaAI {
  constructor() {
    this.difficulty = 'intermediario';
    this.configs = {
      iniciante:     { depth: 1, randomness: 0.75 },
      intermediario: { depth: 3, randomness: 0.10 },
      avancado:      { depth: 5, randomness: 0.02 },
      expert:        { depth: 7, randomness: 0    }
    };
  }

  setDifficulty(level) { this.difficulty = level; }

  /* Avaliação heurística do tabuleiro */
  _evaluate(engine) {
    if (engine.status === 'finished') {
      if (engine.winner === 'w') return  100000;
      if (engine.winner === 'b') return -100000;
      return 0;
    }

    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.piece(r, c);
        if (!p) continue;

        /* Valor base: peão=100, dama=300 */
        let val = p.king ? 300 : 100;

        /* Bônus de centralização */
        val += (3 - Math.abs(c - 3.5)) * 4;

        /* Bônus de avanço */
        val += p.color === 'w' ? (7 - r) * 3 : r * 3;

        /* Bônus por estar na borda (menos vulnerável) */
        if (c === 0 || c === 7) val += 5;

        /* Bônus por ter backup diagonal */
        const backDirs = p.color === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
        for (const [dr, dc] of backDirs) {
          const br = r + dr, bc = c + dc;
          if (br >= 0 && br < 8 && bc >= 0 && bc < 8 &&
              engine.piece(br, bc)?.color === p.color) val += 5;
        }

        score += p.color === 'w' ? val : -val;
      }
    }

    /* Bônus por mobilidade */
    const wMoves = engine.allLegalMovesForColor('w').length;
    const bMoves = engine.allLegalMovesForColor('b').length;
    score += (wMoves - bMoves) * 2;

    return score;
  }

  _minimax(engine, depth, alpha, beta, maximizing) {
    if (depth === 0 || engine.status === 'finished') {
      return this._evaluate(engine);
    }

    const color = maximizing ? 'w' : 'b';
    let moves;

    if (engine.chainPiece) {
      const [cr, cc] = engine.chainPiece;
      moves = engine.legalMoves(cr, cc);
    } else {
      moves = engine.allLegalMovesForColor(color);
    }

    if (moves.length === 0) return maximizing ? -100000 : 100000;

    /* Ordena: capturas primeiro */
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const clone = this._clone(engine);
        clone.makeMove(move.from, move.to);
        const ev = this._minimax(clone, depth - 1, alpha, beta, clone.turn !== 'w');
        maxEval = Math.max(maxEval, ev);
        alpha   = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const clone = this._clone(engine);
        clone.makeMove(move.from, move.to);
        const ev = this._minimax(clone, depth - 1, alpha, beta, clone.turn !== 'b');
        minEval = Math.min(minEval, ev);
        beta    = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  _clone(engine) {
    const c = new DamaEngine();
    c.board        = engine.board.map(row => row.map(p => p ? {...p} : null));
    c.turn         = engine.turn;
    c.history      = [...engine.history];
    c.captured     = {...engine.captured};
    c.status       = engine.status;
    c.winner       = engine.winner;
    c.lastMove     = engine.lastMove
      ? { from:[...engine.lastMove.from], to:[...engine.lastMove.to],
          captured: engine.lastMove.captured ? [...engine.lastMove.captured] : null }
      : null;
    c.chainPiece   = engine.chainPiece   ? [...engine.chainPiece]   : null;
    c.chainSkipped = [...engine.chainSkipped];
    return c;
  }

  getBestMove(engine) {
    const cfg = this.configs[this.difficulty];

    let moves;
    if (engine.chainPiece) {
      const [cr, cc] = engine.chainPiece;
      moves = engine.legalMoves(cr, cc);
    } else {
      moves = engine.allLegalMovesForColor(engine.turn);
    }

    if (!moves || moves.length === 0) return null;

    /* Movimento aleatório nos níveis fáceis */
    if (Math.random() < cfg.randomness) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const maximizing = engine.turn === 'w';
    let bestMove  = null;
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const clone = this._clone(engine);
      clone.makeMove(move.from, move.to);
      const score  = this._minimax(clone, cfg.depth - 1, -Infinity, Infinity, clone.turn !== engine.turn ? maximizing : !maximizing);
      const jitter = (Math.random() - 0.5) * cfg.randomness * 60;

      if (maximizing ? (score + jitter > bestScore) : (score + jitter < bestScore)) {
        bestScore = score + jitter;
        bestMove  = move;
      }
    }

    return bestMove || moves[0];
  }
}