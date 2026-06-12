# Jogos de Tabuleiro Online

Este repositório é a fonte principal do ecossistema de jogos de tabuleiro online.

## Estado atual

- `gorio/jogos`: portal central com login único, identidade do usuário e catálogo.
- `games/xadrez`: código importado do antigo `gorio/xadrez`.
- `games/dama`: código importado do antigo `gorio/dama`.
- `games/ludo`: código importado do antigo `gorio/ludo`.

Os repositórios individuais passam a ser fontes legadas. A evolução do produto deve acontecer neste repositório.

## Arquitetura do monorepo

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

1. Extrair `auth.js`, `history.js` e estilos comuns para `/core`.
2. Remover telas de login duplicadas dos jogos e usar apenas o login do portal.
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
