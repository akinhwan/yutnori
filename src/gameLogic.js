export const START = 'START';
export const HOME = 'HOME';
export const TOKENS_PER_PLAYER = 4;
export const PLAYER_IDS = [1, 2];

export const THROW_NAMES = {
  1: 'Do',
  2: 'Gae',
  3: 'Geol',
  4: 'Yut',
  5: 'Mo',
};

const makeNode = ({
  id,
  x,
  y,
  next,
  branchNext = null,
  cellKey = id,
  stationType = 'normal',
}) => ({
  id,
  x,
  y,
  next,
  branchNext,
  cellKey,
  stationType,
});

export const NODE_MAP = {
  M0: makeNode({ id: 'M0', x: 90, y: 74, next: 'M1' }),
  M1: makeNode({ id: 'M1', x: 90, y: 58, next: 'M2' }),
  M2: makeNode({ id: 'M2', x: 90, y: 42, next: 'M3' }),
  M3: makeNode({ id: 'M3', x: 90, y: 26, next: 'M4' }),
  M4: makeNode({
    id: 'M4',
    x: 90,
    y: 10,
    next: 'M5',
    branchNext: 'A1',
    stationType: 'corner',
  }),
  M5: makeNode({ id: 'M5', x: 74, y: 10, next: 'M6' }),
  M6: makeNode({ id: 'M6', x: 58, y: 10, next: 'M7' }),
  M7: makeNode({ id: 'M7', x: 42, y: 10, next: 'M8' }),
  M8: makeNode({ id: 'M8', x: 26, y: 10, next: 'M9' }),
  M9: makeNode({
    id: 'M9',
    x: 10,
    y: 10,
    next: 'M10',
    branchNext: 'B1',
    stationType: 'corner',
  }),
  M10: makeNode({ id: 'M10', x: 10, y: 26, next: 'M11' }),
  M11: makeNode({ id: 'M11', x: 10, y: 42, next: 'M12' }),
  M12: makeNode({ id: 'M12', x: 10, y: 58, next: 'M13' }),
  M13: makeNode({ id: 'M13', x: 10, y: 74, next: 'M14' }),
  M14: makeNode({
    id: 'M14',
    x: 10,
    y: 90,
    next: 'M15',
    branchNext: 'D1',
    stationType: 'corner',
  }),
  M15: makeNode({ id: 'M15', x: 26, y: 90, next: 'M16' }),
  M16: makeNode({ id: 'M16', x: 42, y: 90, next: 'M17' }),
  M17: makeNode({ id: 'M17', x: 58, y: 90, next: 'M18' }),
  M18: makeNode({ id: 'M18', x: 74, y: 90, next: 'M19' }),
  M19: makeNode({
    id: 'M19',
    x: 90,
    y: 90,
    next: HOME,
    stationType: 'corner',
  }),

  A1: makeNode({ id: 'A1', x: 74, y: 26, next: 'A2', cellKey: 'X1' }),
  A2: makeNode({ id: 'A2', x: 58, y: 42, next: 'CA', cellKey: 'X2' }),
  CA: makeNode({
    id: 'CA',
    x: 50,
    y: 50,
    next: 'A4',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  A4: makeNode({ id: 'A4', x: 42, y: 58, next: 'A5', cellKey: 'X4' }),
  A5: makeNode({ id: 'A5', x: 26, y: 74, next: 'M14', cellKey: 'X5' }),

  B1: makeNode({ id: 'B1', x: 26, y: 26, next: 'B2' }),
  B2: makeNode({ id: 'B2', x: 42, y: 42, next: 'CB' }),
  CB: makeNode({
    id: 'CB',
    x: 50,
    y: 50,
    next: 'B4',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  B4: makeNode({ id: 'B4', x: 58, y: 58, next: 'B5' }),
  B5: makeNode({ id: 'B5', x: 74, y: 74, next: 'M19' }),

  D1: makeNode({ id: 'D1', x: 26, y: 74, next: 'D2', cellKey: 'X5' }),
  D2: makeNode({ id: 'D2', x: 42, y: 58, next: 'CD', cellKey: 'X4' }),
  CD: makeNode({
    id: 'CD',
    x: 50,
    y: 50,
    next: 'D4',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  D4: makeNode({ id: 'D4', x: 58, y: 42, next: 'D5', cellKey: 'X2' }),
  D5: makeNode({ id: 'D5', x: 74, y: 26, next: 'M4', cellKey: 'X1' }),
};

const STATION_PRIORITY = {
  normal: 1,
  corner: 2,
  center: 3,
};

export const BOARD_CELLS = Object.values(NODE_MAP).reduce((cells, node) => {
  const existing = cells[node.cellKey];
  if (!existing) {
    cells[node.cellKey] = {
      id: node.cellKey,
      x: node.x,
      y: node.y,
      stationType: node.stationType,
    };
    return cells;
  }

  if (STATION_PRIORITY[node.stationType] > STATION_PRIORITY[existing.stationType]) {
    existing.stationType = node.stationType;
  }
  return cells;
}, {});

export const BOARD_CELL_LIST = Object.values(BOARD_CELLS);

export const BOARD_LINES = [
  { id: 'top', x1: 10, y1: 10, x2: 90, y2: 10 },
  { id: 'right', x1: 90, y1: 10, x2: 90, y2: 90 },
  { id: 'bottom', x1: 90, y1: 90, x2: 10, y2: 90 },
  { id: 'left', x1: 10, y1: 90, x2: 10, y2: 10 },
  { id: 'diag-a', x1: 90, y1: 10, x2: 10, y2: 90 },
  { id: 'diag-b', x1: 10, y1: 10, x2: 90, y2: 90 },
];

export const createInitialTokens = () => {
  const tokens = {};
  PLAYER_IDS.forEach((player) => {
    tokens[player] = {};
    for (let tokenId = 1; tokenId <= TOKENS_PER_PLAYER; tokenId += 1) {
      tokens[player][String(tokenId)] = START;
    }
  });
  return tokens;
};

export const rollThrow = () => {
  const sticks = Array.from({ length: 4 }, () =>
    Math.random() < 0.5 ? 'flat' : 'round'
  );
  const flatCount = sticks.filter((stickFace) => stickFace === 'flat').length;
  const value = flatCount === 0 ? 5 : flatCount;

  return {
    sticks,
    value,
    name: THROW_NAMES[value],
    extraTurn: value >= 4,
  };
};

export const getCellKey = (position) => {
  if (position === START || position === HOME) {
    return position;
  }
  return NODE_MAP[position]?.cellKey ?? position;
};

export const advancePosition = (position, steps, useBranch = false) => {
  if (steps <= 0 || position === HOME) {
    return position;
  }

  let current = position;
  let stepsRemaining = steps;
  let firstStep = true;

  if (position === START) {
    current = 'M0';
    stepsRemaining -= 1;
    firstStep = false;
  }

  if (stepsRemaining <= 0) {
    return current;
  }

  while (stepsRemaining > 0) {
    const node = NODE_MAP[current];
    if (!node) {
      return HOME;
    }

    const shouldBranch = firstStep && useBranch && Boolean(node.branchNext);
    current = shouldBranch ? node.branchNext : node.next;

    if (!current || current === HOME) {
      return HOME;
    }

    stepsRemaining -= 1;
    firstStep = false;
  }

  return current;
};

export const getDestinationOptions = (position, steps) => {
  if (!position || position === HOME || steps <= 0) {
    return [];
  }

  const options = [
    {
      useBranch: false,
      position: advancePosition(position, steps, false),
    },
  ];

  if (position !== START && NODE_MAP[position]?.branchNext) {
    const branchDestination = advancePosition(position, steps, true);
    const hasMatch = options.some(
      (option) => option.position === branchDestination
    );
    if (!hasMatch) {
      options.push({ useBranch: true, position: branchDestination });
    }
  }

  return options;
};

export const getStackTokenIds = (tokens, player, tokenId) => {
  const selectedTokenId = String(tokenId);
  const selectedPosition = tokens[player][selectedTokenId];

  if (!selectedPosition || selectedPosition === START || selectedPosition === HOME) {
    return [selectedTokenId];
  }

  const selectedCell = getCellKey(selectedPosition);
  return Object.keys(tokens[player]).filter((id) => {
    const tokenPosition = tokens[player][id];
    if (!tokenPosition || tokenPosition === START || tokenPosition === HOME) {
      return false;
    }
    return getCellKey(tokenPosition) === selectedCell;
  });
};

export const applyMove = (tokens, player, tokenId, destination) => {
  const movingPlayer = Number(player);
  const opponent = movingPlayer === 1 ? 2 : 1;

  const nextTokens = {
    1: { ...tokens[1] },
    2: { ...tokens[2] },
  };

  const movedTokenIds = getStackTokenIds(tokens, movingPlayer, tokenId);
  movedTokenIds.forEach((id) => {
    nextTokens[movingPlayer][id] = destination;
  });

  const capturedTokenIds = [];
  if (destination !== HOME) {
    const destinationCell = getCellKey(destination);
    Object.keys(nextTokens[opponent]).forEach((opponentTokenId) => {
      const position = nextTokens[opponent][opponentTokenId];
      if (!position || position === START || position === HOME) {
        return;
      }
      if (getCellKey(position) === destinationCell) {
        nextTokens[opponent][opponentTokenId] = START;
        capturedTokenIds.push(opponentTokenId);
      }
    });
  }

  return {
    tokens: nextTokens,
    movedTokenIds,
    capturedTokenIds,
  };
};

export const countHomeTokens = (tokens, player) =>
  Object.values(tokens[player]).filter((position) => position === HOME).length;

export const hasPlayerWon = (tokens, player) =>
  countHomeTokens(tokens, player) === TOKENS_PER_PLAYER;
