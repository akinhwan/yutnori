export const START = 'START';
export const HOME = 'HOME';
export const TOKENS_PER_PLAYER = 4;
export const PLAYER_IDS = [1, 2];
export const BACK_STICK_INDEX = 0;
export const BACK_DO_EMPTY_BOARD_RULE = 'do';

export const THROW_NAMES = {
  [-1]: 'Back Do',
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
  stationName = '',
  stationSubname = '',
  cellKey = id,
  stationType = 'normal',
}) => ({
  id,
  x,
  y,
  next,
  branchNext,
  stationName,
  stationSubname,
  cellKey,
  stationType,
});

export const NODE_MAP = {
  M0: makeNode({ id: 'M0', x: 90, y: 74, next: 'M1', stationName: 'do' }),
  M1: makeNode({ id: 'M1', x: 90, y: 58, next: 'M2', stationName: 'gae' }),
  M2: makeNode({ id: 'M2', x: 90, y: 42, next: 'M3', stationName: 'geol' }),
  M3: makeNode({ id: 'M3', x: 90, y: 26, next: 'M4', stationName: 'yut' }),
  M4: makeNode({
    id: 'M4',
    x: 90,
    y: 10,
    next: 'M5',
    branchNext: 'A1',
    stationName: 'mo',
    stationType: 'corner',
  }),
  M5: makeNode({ id: 'M5', x: 74, y: 10, next: 'M6', stationName: 'duet-mo' }),
  M6: makeNode({ id: 'M6', x: 58, y: 10, next: 'M7', stationName: 'duet-gae' }),
  M7: makeNode({ id: 'M7', x: 42, y: 10, next: 'M8', stationName: 'duet-geol' }),
  M8: makeNode({ id: 'M8', x: 26, y: 10, next: 'M9', stationName: 'duet-yut' }),
  M9: makeNode({
    id: 'M9',
    x: 10,
    y: 10,
    next: 'M10',
    branchNext: 'B1',
    stationName: 'duet-mo',
    stationSubname: '(busan)',
    stationType: 'corner',
  }),
  M10: makeNode({ id: 'M10', x: 10, y: 26, next: 'M11', stationName: 'chi-do' }),
  M11: makeNode({ id: 'M11', x: 10, y: 42, next: 'M12', stationName: 'chi-gae' }),
  M12: makeNode({ id: 'M12', x: 10, y: 58, next: 'M13', stationName: 'chi-geol' }),
  M13: makeNode({ id: 'M13', x: 10, y: 74, next: 'M14', stationName: 'chi-yut' }),
  M14: makeNode({
    id: 'M14',
    x: 10,
    y: 90,
    next: 'M15',
    branchNext: 'D1',
    stationName: 'chi-mo',
    stationType: 'corner',
  }),
  M15: makeNode({ id: 'M15', x: 26, y: 90, next: 'M16', stationName: 'nal-do' }),
  M16: makeNode({ id: 'M16', x: 42, y: 90, next: 'M17', stationName: 'nal-gae' }),
  M17: makeNode({ id: 'M17', x: 58, y: 90, next: 'M18', stationName: 'nal-geol' }),
  M18: makeNode({ id: 'M18', x: 74, y: 90, next: 'M19', stationName: 'nal-yut' }),
  M19: makeNode({
    id: 'M19',
    x: 90,
    y: 90,
    next: HOME,
    stationName: 'cham-meoki',
    stationType: 'corner',
  }),

  A1: makeNode({
    id: 'A1',
    x: 76.7,
    y: 23.3,
    next: 'A2',
    stationName: 'mo-do',
    cellKey: 'X1',
  }),
  A2: makeNode({
    id: 'A2',
    x: 63.3,
    y: 36.7,
    next: 'CA',
    stationName: 'mo-gae',
    cellKey: 'X2',
  }),
  CA: makeNode({
    id: 'CA',
    x: 50,
    y: 50,
    next: 'A4',
    stationName: 'bang',
    stationSubname: '(seoul)',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  A4: makeNode({
    id: 'A4',
    x: 36.7,
    y: 63.3,
    next: 'A5',
    stationName: 'sok-yut',
    cellKey: 'X4',
  }),
  A5: makeNode({
    id: 'A5',
    x: 23.3,
    y: 76.7,
    next: 'M14',
    stationName: 'sok-mo',
    cellKey: 'X5',
  }),

  B1: makeNode({ id: 'B1', x: 23.3, y: 23.3, next: 'B2', stationName: 'duet-modo' }),
  B2: makeNode({ id: 'B2', x: 36.7, y: 36.7, next: 'CB', stationName: 'duet-mogae' }),
  CB: makeNode({
    id: 'CB',
    x: 50,
    y: 50,
    next: 'B4',
    stationName: 'bang',
    stationSubname: '(seoul)',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  B4: makeNode({ id: 'B4', x: 63.3, y: 63.3, next: 'B5', stationName: 'saryeo' }),
  B5: makeNode({ id: 'B5', x: 76.7, y: 76.7, next: 'M19', stationName: 'anchi' }),

  D1: makeNode({
    id: 'D1',
    x: 23.3,
    y: 76.7,
    next: 'D2',
    stationName: 'sok-mo',
    cellKey: 'X5',
  }),
  D2: makeNode({
    id: 'D2',
    x: 36.7,
    y: 63.3,
    next: 'CD',
    stationName: 'sok-yut',
    cellKey: 'X4',
  }),
  CD: makeNode({
    id: 'CD',
    x: 50,
    y: 50,
    next: 'D4',
    stationName: 'bang',
    stationSubname: '(seoul)',
    cellKey: 'CENTER',
    stationType: 'center',
  }),
  D4: makeNode({
    id: 'D4',
    x: 63.3,
    y: 36.7,
    next: 'D5',
    stationName: 'mo-gae',
    cellKey: 'X2',
  }),
  D5: makeNode({
    id: 'D5',
    x: 76.7,
    y: 23.3,
    next: 'M4',
    stationName: 'mo-do',
    cellKey: 'X1',
  }),
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
      stationName: node.stationName,
      stationSubname: node.stationSubname,
      stationType: node.stationType,
    };
    return cells;
  }

  if (STATION_PRIORITY[node.stationType] > STATION_PRIORITY[existing.stationType]) {
    existing.stationType = node.stationType;
  }
  if (!existing.stationName && node.stationName) {
    existing.stationName = node.stationName;
  }
  if (!existing.stationSubname && node.stationSubname) {
    existing.stationSubname = node.stationSubname;
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
  const isBackStickDown = sticks[BACK_STICK_INDEX] === 'flat';
  const flatCount = sticks.filter((stickFace) => stickFace === 'flat').length;
  const value =
    isBackStickDown && flatCount === 1 ? -1 : flatCount === 0 ? 5 : flatCount;

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

const REVERSE_NODE_MAP = Object.entries(NODE_MAP).reduce((reverseMap, [nodeId, node]) => {
  if (node.next) {
    if (!reverseMap[node.next]) {
      reverseMap[node.next] = [];
    }
    reverseMap[node.next].push(nodeId);
  }

  if (node.branchNext) {
    if (!reverseMap[node.branchNext]) {
      reverseMap[node.branchNext] = [];
    }
    reverseMap[node.branchNext].push(nodeId);
  }

  return reverseMap;
}, {});

export const retreatPosition = (position, steps) => {
  if (steps <= 0 || position === START || position === HOME) {
    return [position];
  }

  let currentPositions = [position];

  for (let step = 0; step < steps; step += 1) {
    const nextPositions = new Set();

    currentPositions.forEach((currentPosition) => {
      if (currentPosition === 'M0') {
        nextPositions.add(START);
        return;
      }

      const previousPositions = REVERSE_NODE_MAP[currentPosition] ?? [];
      if (previousPositions.length === 0) {
        nextPositions.add(START);
        return;
      }

      previousPositions.forEach((previousPosition) => {
        nextPositions.add(previousPosition);
      });
    });

    currentPositions = Array.from(nextPositions);
  }

  return currentPositions;
};

export const getDestinationOptions = (position, steps) => {
  if (!position || position === HOME || steps === 0) {
    return [];
  }

  if (steps < 0) {
    const destinations = retreatPosition(position, Math.abs(steps));
    return destinations.map((destination) => ({
      useBranch: false,
      position: destination,
    }));
  }

  // Center is rendered as one merged cell, but movement should still use the
  // token's concrete center node to avoid allowing backward travel.
  if (getCellKey(position) === 'CENTER') {
    const centerOriginsByPosition = {
      CA: ['CA', 'CB'],
      CB: ['CB', 'CD'],
      CD: ['CD', 'CA'],
    };
    const centerOrigins = centerOriginsByPosition[position] ?? [position];
    const uniqueDestinations = new Set();

    centerOrigins.forEach((origin) => {
      const destination = advancePosition(origin, steps, false);
      uniqueDestinations.add(destination);
    });

    return Array.from(uniqueDestinations).map((destination) => ({
      useBranch: false,
      position: destination,
    }));
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

export const hasTokenOnCourse = (tokens, player) =>
  Object.values(tokens[player]).some(
    (position) => position !== START && position !== HOME
  );
