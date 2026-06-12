# Jogos de Tabuleiro Online

Este repositório passa a ser a porta de entrada única para o ecossistema de jogos.

## Estado atual

- `gorio/jogos`: portal central com login único, identidade do usuário e catálogo.
- `gorio/xadrez`: jogo existente em `https://gorio.github.io/xadrez/`.
- `gorio/dama`: jogo existente em `https://gorio.github.io/dama/`.
- `gorio/ludo`: jogo existente em `https://gorio.github.io/ludo/`.

Como todos rodam sob `gorio.github.io` e usam o mesmo projeto Firebase, a sessão de autenticação é compartilhada pelo navegador.

## Arquitetura alvo

```text
/jogos
  /core
    auth.js
    firebase.js
    history.js
    live-games.js
    ui.css
  /games
    /xadrez
    /dama
    /ludo
  index.html
```

## Próximas etapas

1. Migrar `auth.js`, `history.js` e estilos comuns para `/core`.
2. Mover os motores dos jogos para `/games/<jogo>`.
3. Padronizar contrato de salas:
   - `gameType`
   - `roomCode`
   - `players`
   - `state`
   - `status`
   - `createdAt`
   - `updatedAt`
4. Criar histórico unificado por usuário com filtros por jogo.
5. Criar ranking, partidas ao vivo e perfil público.
6. Transformar o portal em PWA instalável.

## Segurança e manutenção

- Firebase Auth permanece como provedor único.
- Regras do Realtime Database devem separar leitura pública de partidas ao vivo e escrita autenticada.
- Cada jogo precisa validar estado antes de salvar ou reproduzir partidas.
- O frontend não deve confiar em dados de sala sem normalização local.
