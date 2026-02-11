import './Board.css';
import {
  BOARD_CELL_LIST,
  BOARD_LINES,
  HOME,
  START,
  TOKENS_PER_PLAYER,
  getCellKey,
} from './gameLogic';

const TOKEN_IDS = Array.from(
  { length: TOKENS_PER_PLAYER },
  (_, index) => String(index + 1)
);

const getLineStyle = ({ x1, y1, x2, y2 }) => {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

  return {
    left: `${x1}%`,
    top: `${y1}%`,
    width: `${length}%`,
    transform: `translateY(-50%) rotate(${angle}deg)`,
  };
};

const activateOnKey = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
};

function Board({
  tokens,
  currentPlayer,
  selectedTokenId,
  pendingMove,
  shouldHighlightStartTokens,
  destinationOptions,
  onTokenSelect,
  onDestinationSelect,
}) {
  const boardTokensByCell = {};
  const startTokensByPlayer = {
    1: new Set(),
    2: new Set(),
  };
  const homeCountByPlayer = {
    1: 0,
    2: 0,
  };

  Object.entries(tokens).forEach(([playerId, playerTokens]) => {
    const player = Number(playerId);
    Object.entries(playerTokens).forEach(([tokenId, position]) => {
      if (position === START) {
        startTokensByPlayer[player].add(tokenId);
        return;
      }

      if (position === HOME) {
        homeCountByPlayer[player] += 1;
        return;
      }

      const cellKey = getCellKey(position);
      if (!boardTokensByCell[cellKey]) {
        boardTokensByCell[cellKey] = [];
      }
      boardTokensByCell[cellKey].push({
        player,
        tokenId,
      });
    });
  });

  Object.values(boardTokensByCell).forEach((tokenList) => {
    tokenList.sort((a, b) => {
      if (a.player !== b.player) {
        return a.player - b.player;
      }
      return Number(a.tokenId) - Number(b.tokenId);
    });
  });

  const destinationByCell = {};
  destinationOptions.forEach((destinationOption) => {
    const cellKey = getCellKey(destinationOption.position);
    if (!destinationByCell[cellKey]) {
      destinationByCell[cellKey] = destinationOption;
    }
  });

  const renderPlayerPanel = (player) => {
    const isCurrentPlayer = player === currentPlayer;
    const canSelectToken = isCurrentPlayer && pendingMove !== null;
    const highlightStartTokens = shouldHighlightStartTokens && isCurrentPlayer;
    const hasHomeTokens = homeCountByPlayer[player] > 0;

    return (
      <section
        className={`player-panel player-panel-${player} ${
          hasHomeTokens ? 'player-panel-has-home' : ''
        } ${isCurrentPlayer ? 'player-panel-active' : ''}`}
      >
        {/* <h2 className="panel-title">Player {player} {PLAYER_LABELS[player]}</h2> */}

        <p className="panel-label">Mal (horses)</p>
        <div
          className={`start-token-row ${
            highlightStartTokens ? 'start-token-row-highlight' : ''
          }`}
        >
          {TOKEN_IDS.map((tokenId) => {
            const isAtStart = startTokensByPlayer[player].has(tokenId);
            if (!isAtStart) {
              return (
                <span
                  key={`start-empty-${player}-${tokenId}`}
                  className="bank-token-slot"
                />
              );
            }

            const isSelected =
              isCurrentPlayer && selectedTokenId === tokenId && canSelectToken;

            return (
              <button
                type="button"
                key={`start-${player}-${tokenId}`}
                className={`bank-token bank-token-player-${player} ${
                  isCurrentPlayer ? 'bank-token-pulsing' : ''
                } ${isSelected ? 'bank-token-selected' : ''}`}
                onClick={() => onTokenSelect(tokenId)}
                disabled={!canSelectToken}
              >
                {tokenId}
              </button>
            );
          })}
        </div>

        {hasHomeTokens ? (
          <>
            <p className="panel-label">Home ({homeCountByPlayer[player]}/4)</p>
            <div className="home-slot-row">
              {Array.from({ length: TOKENS_PER_PLAYER }).map((_, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`home-${player}-${index}`}
                  className={`home-slot ${
                    index < homeCountByPlayer[player] ? 'home-slot-filled' : ''
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>
    );
  };

  return (
    <div className="board-layout">
      {renderPlayerPanel(currentPlayer)}

      <div className="board-shell">
        <div className="board-surface">
          {BOARD_LINES.map((line) => (
            <div
              key={line.id}
              className="track-line"
              style={getLineStyle(line)}
            />
          ))}

          {BOARD_CELL_LIST.map((cell) => {
            const cellTokens = boardTokensByCell[cell.id] ?? [];
            const destinationOption = destinationByCell[cell.id];
            const isDestination =
              pendingMove !== null && Boolean(destinationOption);
            const allowTokenPicking = pendingMove !== null && !isDestination;

            return (
              <div
                key={cell.id}
                className={`station station-${cell.stationType} ${
                  isDestination ? 'station-destination' : ''
                }`}
                style={{
                  left: `${cell.x}%`,
                  top: `${cell.y}%`,
                }}
                role={isDestination ? 'button' : undefined}
                tabIndex={isDestination ? 0 : -1}
                onClick={() => {
                  if (isDestination) {
                    onDestinationSelect(destinationOption);
                  }
                }}
                onKeyDown={(event) => {
                  if (isDestination) {
                    activateOnKey(event, () =>
                      onDestinationSelect(destinationOption)
                    );
                  }
                }}
                title={cell.stationName || cell.id}
              >
                {isDestination ? <span className="destination-dot" /> : null}
                {cell.stationName ? (
                  <span className="station-label">
                    <span className="station-label-main">{cell.stationName}</span>
                    {cell.stationSubname ? (
                      <span className="station-label-sub">{cell.stationSubname}</span>
                    ) : null}
                  </span>
                ) : null}

                <div className="cell-token-layer">
                  {cellTokens.map((token) => {
                    const isCurrentPlayerToken = token.player === currentPlayer;
                    const canSelectThisToken =
                      isCurrentPlayerToken && allowTokenPicking;
                    const isSelected =
                      isCurrentPlayerToken &&
                      selectedTokenId === token.tokenId &&
                      canSelectThisToken;

                    return (
                      <div
                        key={`cell-token-${token.player}-${token.tokenId}-${cell.id}`}
                        className={`token token-player-${token.player} ${
                          isCurrentPlayerToken ? 'token-pulsing' : ''
                        } ${
                          canSelectThisToken ? 'token-clickable' : ''
                        } ${isSelected ? 'token-selected' : ''}`}
                        role={canSelectThisToken ? 'button' : undefined}
                        tabIndex={canSelectThisToken ? 0 : -1}
                        onClick={(event) => {
                          if (canSelectThisToken) {
                            event.stopPropagation();
                            onTokenSelect(token.tokenId);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (canSelectThisToken) {
                            event.stopPropagation();
                            activateOnKey(event, () =>
                              onTokenSelect(token.tokenId)
                            );
                          }
                        }}
                        title={`Player ${token.player} mal ${token.tokenId}`}
                      >
                        {token.tokenId}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Board;
