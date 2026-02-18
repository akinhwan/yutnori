import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import Board from './Board';
import {
  BACK_DO_EMPTY_BOARD_RULE,
  BACK_STICK_INDEX,
  HOME,
  NODE_MAP,
  START,
  THROW_NAMES,
  applyMove,
  countHomeTokens,
  createInitialTokens,
  getCellKey,
  getDestinationOptions,
  hasTokenOnCourse,
  hasPlayerWon,
  rollThrow,
} from './gameLogic';

const PLAYER_LABELS = {
  1: 'Red',
  2: 'Blue',
};
const getPlayerName = (player) => PLAYER_LABELS[player] ?? `Player ${player}`;

const GAME_MODES = {
  SINGLE: 'single',
  MULTI: 'multi',
};

const AI_PLAYER_ID = 2;
const describeThrow = (value) => `${THROW_NAMES[value]} (${value})`;
const splitStatusMessage = (message) =>
  message.split(/(?<=[.!?])\s+/).filter(Boolean);
const DEFAULT_STICKS = ['round', 'round', 'round', 'round'];
const THROW_FLIGHT_DURATION_MS = 610;
const THROW_SETTLE_DURATION_MS = 380;
const THROW_STICKS_SETTLE_DURATION_MS =
  THROW_FLIGHT_DURATION_MS + THROW_SETTLE_DURATION_MS;
const THROW_FACE_LOCK_START_PROGRESS = 0.985;
const THROW_RESULT_HOLD_MS = 420;
const THROW_TOTAL_DURATION_MS =
  THROW_STICKS_SETTLE_DURATION_MS + THROW_RESULT_HOLD_MS;
const THROW_STICKS_SETTLE_DURATION_SECONDS =
  THROW_STICKS_SETTLE_DURATION_MS / 1000;
const AI_ACTION_DELAY_MS = 550;
const AI_LOOKAHEAD_DEPTH = 4;
const WINNING_ACTION_SCORE = 1_000_000;
const VICTORY_CELEBRATION_DURATION_MS = 4200;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getNearestFaceRotation = (angle, targetRotation) =>
  targetRotation + Math.round((angle - targetRotation) / 360) * 360;

const getDestinationOptionKey = (option) =>
  `${option.position}:${option.useBranch ? '1' : '0'}`;

const createThrowPhysicsStates = ({
  stageWidth,
  stageHeight,
  stickFaces = DEFAULT_STICKS,
}) => {
  const normalizedHeight = Math.max(460, stageHeight);
  const landingTilts = [-9, -3, 3, 9];
  const compactSpacing = clamp(stageWidth * 0.082, 34, 58);
  const landingRow = [-1.5, -0.5, 0.5, 1.5].map(
    (slotMultiplier) => slotMultiplier * compactSpacing
  );
  const releaseSpan = clamp(stageWidth * 1.05, 260, 900);
  const minFlightSeconds = THROW_FLIGHT_DURATION_MS * 0.00078;
  const maxFlightSeconds = THROW_FLIGHT_DURATION_MS * 0.00095;

  return Array.from({ length: 4 }, (_, index) => {
    const startX = randomBetween(-releaseSpan * 0.5, releaseSpan * 0.5);
    const landingX = landingRow[index];
    const flightDurationSeconds = randomBetween(minFlightSeconds, maxFlightSeconds);
    const gravity = randomBetween(
      normalizedHeight * 3.25,
      normalizedHeight * 3.75
    );
    const vy = (gravity * flightDurationSeconds) / 2;
    const vx = (landingX - startX) / flightDurationSeconds;
    const targetFaceRotation = stickFaces[index] === 'flat' ? 0 : 180;
    const initialFlipCycles = randomBetween(2.2, 3.5);
    const initialFaceRotation = randomBetween(-180, 180);
    const baseTilt = landingTilts[index];

    return {
      x: startX,
      y: 0,
      vx,
      vy,
      gravity,
      airDrag: randomBetween(0.09, 0.17),
      angleZ: randomBetween(-34, 34),
      omegaZ: randomBetween(-240, 240),
      angleFlip:
        initialFaceRotation -
        initialFlipCycles * 360 +
        randomBetween(-38, 38),
      omegaFlip: randomBetween(900, 1380) * (Math.random() < 0.5 ? -1 : 1),
      targetFaceRotation,
      targetTilt: baseTilt + randomBetween(-1.25, 1.25),
      bounceCount: 0,
      maxBounces: Math.random() < 0.2 ? 2 : 1,
      restitution: randomBetween(0.18, 0.28),
      minBounceSpeed: normalizedHeight * 0.28,
      impactFriction: randomBetween(0.61, 0.74),
      groundSlideDrag: randomBetween(10.2, 13.2),
      tiltSpring: randomBetween(54, 74),
      tiltDamping: randomBetween(12, 16),
      flipSpring: randomBetween(72, 96),
      flipDamping: randomBetween(14, 18),
      grounded: false,
      groundedAtSeconds: null,
      opacity: 0,
      revealDelay: randomBetween(0, 0.1),
      settlePhase: randomBetween(0, Math.PI * 2),
      settleDuration: randomBetween(0.2, 0.3),
      impactDuration: randomBetween(0.09, 0.14),
      impactTimer: 0,
      impactStrength: 0,
      contactBounceHeight: randomBetween(2.8, 5.2),
      scaleX: 1,
      scaleY: 1,
      landingX,
    };
  });
};

const advanceThrowStickState = (
  stickState,
  deltaSeconds,
  elapsedSeconds,
  totalDurationSeconds
) => {
  const step = Math.min(deltaSeconds, 1 / 28);

  if (elapsedSeconds >= stickState.revealDelay) {
    stickState.opacity = Math.min(1, stickState.opacity + step * 10);
  }

  if (!stickState.grounded) {
    stickState.vx *= Math.exp(-stickState.airDrag * step);
    stickState.x += stickState.vx * step;
    stickState.vy -= stickState.gravity * step;
    stickState.y += stickState.vy * step;

    stickState.omegaZ *= Math.exp(-0.32 * step);
    stickState.omegaFlip *= Math.exp(-0.2 * step);
    stickState.angleZ += stickState.omegaZ * step;
    stickState.angleFlip += stickState.omegaFlip * step;

    if (stickState.y <= 0 && stickState.vy < 0) {
      const impactSpeed = Math.abs(stickState.vy);
      stickState.y = 0;

      if (
        stickState.bounceCount < stickState.maxBounces &&
        impactSpeed > stickState.minBounceSpeed
      ) {
        stickState.bounceCount += 1;
        const restitutionScale = Math.max(
          0.08,
          stickState.restitution - stickState.bounceCount * 0.04
        );
        stickState.vy = impactSpeed * restitutionScale;
        stickState.vx *= stickState.impactFriction;
        stickState.omegaZ *= 0.72;
        stickState.omegaFlip *= 0.58;
        stickState.impactTimer = stickState.impactDuration * 0.52;
        stickState.impactStrength = clamp(
          impactSpeed / (stickState.minBounceSpeed * 6.4),
          0.025,
          0.085
        );
      } else {
        stickState.grounded = true;
        stickState.vy = 0;
        stickState.groundedAtSeconds = elapsedSeconds;
        stickState.impactTimer = stickState.impactDuration;
        stickState.impactStrength = clamp(
          impactSpeed / (stickState.minBounceSpeed * 2.35),
          0.07,
          0.22
        );
      }
    }
    return;
  }

  const settleElapsed = Math.max(
    0,
    elapsedSeconds - (stickState.groundedAtSeconds ?? elapsedSeconds)
  );
  const settleProgress = clamp(
    settleElapsed / Math.max(0.001, stickState.settleDuration),
    0,
    1
  );
  const totalProgress = clamp(elapsedSeconds / totalDurationSeconds, 0, 1);
  const faceLockProgress = clamp(
    (totalProgress - THROW_FACE_LOCK_START_PROGRESS) /
      Math.max(0.001, 1 - THROW_FACE_LOCK_START_PROGRESS),
    0,
    1
  );

  stickState.x += stickState.vx * step;
  stickState.vx *= Math.exp(-stickState.groundSlideDrag * step);

  const closestFaceRotation = getNearestFaceRotation(
    stickState.angleFlip,
    stickState.targetFaceRotation
  );
  const faceDelta = closestFaceRotation - stickState.angleFlip;
  if (faceLockProgress > 0) {
    const lockFlipSpring =
      stickState.flipSpring * (1.9 + faceLockProgress * 2.2);
    const lockFlipDamping =
      stickState.flipDamping * (1.1 + faceLockProgress * 0.9);
    stickState.omegaFlip += faceDelta * lockFlipSpring * step;
    stickState.omegaFlip *= Math.exp(-lockFlipDamping * step);
  } else {
    // Keep the face unresolved until the final reveal window.
    stickState.omegaFlip *= Math.exp(-0.08 * step);
  }
  stickState.angleFlip += stickState.omegaFlip * step;

  const tiltDelta = stickState.targetTilt - stickState.angleZ;
  stickState.omegaZ += tiltDelta * stickState.tiltSpring * step;
  stickState.omegaZ *= Math.exp(-stickState.tiltDamping * step);
  stickState.angleZ += stickState.omegaZ * step;

  stickState.x += (stickState.landingX - stickState.x) * step * 5.4 * settleProgress;

  if (stickState.impactTimer > 0) {
    stickState.impactTimer = Math.max(0, stickState.impactTimer - step);
    const impactProgress =
      1 - stickState.impactTimer / Math.max(0.001, stickState.impactDuration);
    const impactEnvelope =
      Math.sin(impactProgress * Math.PI) * (1 - settleProgress * 0.6);
    stickState.y =
      impactEnvelope *
      stickState.contactBounceHeight *
      (0.45 + stickState.impactStrength * 2.4);

    const squashAmount =
      Math.max(0, Math.sin(impactProgress * Math.PI * 0.92)) *
      stickState.impactStrength *
      0.5;
    stickState.scaleX = 1 + squashAmount;
    stickState.scaleY = 1 - squashAmount;
  } else {
    stickState.y = 0;
    stickState.scaleX += (1 - stickState.scaleX) * step * 22;
    stickState.scaleY += (1 - stickState.scaleY) * step * 22;
  }

  if (settleProgress > 0.72) {
    stickState.scaleX += (1 - stickState.scaleX) * step * 24;
    stickState.scaleY += (1 - stickState.scaleY) * step * 24;
  }

  if (
    faceLockProgress > 0 &&
    Math.abs(faceDelta) < 0.95 &&
    Math.abs(stickState.omegaFlip) < 6.5
  ) {
    stickState.angleFlip = stickState.targetFaceRotation;
    stickState.omegaFlip = 0;
  }

  if (Math.abs(tiltDelta) < 0.35 && Math.abs(stickState.omegaZ) < 5.2) {
    stickState.angleZ = stickState.targetTilt;
    stickState.omegaZ = 0;
  }

  if (Math.abs(stickState.landingX - stickState.x) < 0.6 && Math.abs(stickState.vx) < 6) {
    stickState.x = stickState.landingX;
    stickState.vx = 0;
  }

  if (totalProgress > 0.9) {
    stickState.scaleX += (1 - stickState.scaleX) * step * 28;
    stickState.scaleY += (1 - stickState.scaleY) * step * 28;
  }
};

const applyThrowStickTransform = (element, stickState) => {
  if (!element || !stickState) {
    return;
  }

  const yawAngle = stickState.angleZ * 0.24;
  element.style.opacity = stickState.opacity.toFixed(3);
  element.style.transform = `translate3d(${stickState.x.toFixed(2)}px, ${(
    -stickState.y
  ).toFixed(2)}px, 0) rotateZ(${stickState.angleZ.toFixed(
    2
  )}deg) rotateY(${yawAngle.toFixed(2)}deg) rotateX(${stickState.angleFlip.toFixed(
    2
  )}deg) scale3d(${stickState.scaleX.toFixed(3)}, ${stickState.scaleY.toFixed(
    3
  )}, 1)`;
};

const getOpponent = (player) => (Number(player) === 1 ? 2 : 1);

const buildDistanceToHomeMap = () => {
  const distanceMap = { HOME: 0 };
  const reverseEdges = {};
  const queue = [];
  const queued = new Set();

  Object.keys(NODE_MAP).forEach((nodeId) => {
    reverseEdges[nodeId] = [];
  });

  Object.entries(NODE_MAP).forEach(([nodeId, node]) => {
    const targets = [node.next, node.branchNext].filter(Boolean);

    targets.forEach((targetId) => {
      if (targetId === HOME) {
        if (!Object.prototype.hasOwnProperty.call(distanceMap, nodeId)) {
          distanceMap[nodeId] = 1;
        } else {
          distanceMap[nodeId] = Math.min(distanceMap[nodeId], 1);
        }

        if (!queued.has(nodeId)) {
          queue.push(nodeId);
          queued.add(nodeId);
        }
        return;
      }

      if (!reverseEdges[targetId]) {
        reverseEdges[targetId] = [];
      }
      reverseEdges[targetId].push(nodeId);
    });
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDistance = distanceMap[current];
    const parentNodes = reverseEdges[current] ?? [];

    parentNodes.forEach((parentId) => {
      const candidateDistance = currentDistance + 1;
      const parentDistance = distanceMap[parentId];

      if (
        typeof parentDistance !== 'number' ||
        candidateDistance < parentDistance
      ) {
        distanceMap[parentId] = candidateDistance;
        if (!queued.has(parentId)) {
          queue.push(parentId);
          queued.add(parentId);
        }
      }
    });
    queued.delete(current);
  }

  distanceMap.START = typeof distanceMap.M0 === 'number' ? distanceMap.M0 + 1 : 0;
  return distanceMap;
};

const DISTANCE_TO_HOME = buildDistanceToHomeMap();
const START_DISTANCE_TO_HOME = DISTANCE_TO_HOME.START ?? 0;

const getProgressValue = (position) => {
  if (!position || position === START) {
    return 0;
  }

  if (position === HOME) {
    return START_DISTANCE_TO_HOME + 1;
  }

  const distance = DISTANCE_TO_HOME[position];
  if (typeof distance !== 'number') {
    return 0;
  }

  return START_DISTANCE_TO_HOME - distance;
};

const countStartTokens = (tokens, player) =>
  Object.values(tokens[player]).filter((position) => position === START).length;

const getBoardCellCounts = (tokens, player) => {
  const counts = {};

  Object.values(tokens[player]).forEach((position) => {
    if (!position || position === START || position === HOME) {
      return;
    }

    const cellKey = getCellKey(position);
    counts[cellKey] = (counts[cellKey] ?? 0) + 1;
  });

  return counts;
};

const getThreatenedCellWeights = (tokens, attacker) => {
  const threatenedWeights = {};

  Object.values(tokens[attacker]).forEach((position) => {
    if (!position || position === HOME) {
      return;
    }

    for (let steps = 1; steps <= 5; steps += 1) {
      const options = getDestinationOptions(position, steps);
      options.forEach((option) => {
        if (!option.position || option.position === START || option.position === HOME) {
          return;
        }

        const cellKey = getCellKey(option.position);
        threatenedWeights[cellKey] = (threatenedWeights[cellKey] ?? 0) + 1;
      });
    }
  });

  return threatenedWeights;
};

const estimateVulnerabilityPenalty = (tokens, player) => {
  const opponent = getOpponent(player);
  const threatenedCells = getThreatenedCellWeights(tokens, opponent);
  const playerCellCounts = getBoardCellCounts(tokens, player);

  return Object.entries(playerCellCounts).reduce(
    (totalPenalty, [cellKey, tokenCount]) =>
      totalPenalty + (threatenedCells[cellKey] ?? 0) * tokenCount * 14,
    0
  );
};

const estimateCapturePotential = (tokens, player) => {
  const opponent = getOpponent(player);
  const opponentCellCounts = getBoardCellCounts(tokens, opponent);
  let potential = 0;

  for (const position of Object.values(tokens[player])) {
    if (!position || position === HOME) {
      continue;
    }

    for (let steps = 1; steps <= 5; steps += 1) {
      const options = getDestinationOptions(position, steps);
      for (const option of options) {
        if (!option.position || option.position === START || option.position === HOME) {
          continue;
        }

        const cellKey = getCellKey(option.position);
        potential += opponentCellCounts[cellKey] ?? 0;
      }
    }
  }

  return potential;
};

const evaluateBoardState = (tokens, player) => {
  const opponent = getOpponent(player);
  const playerHomeCount = countHomeTokens(tokens, player);
  const opponentHomeCount = countHomeTokens(tokens, opponent);
  const playerStartCount = countStartTokens(tokens, player);
  const opponentStartCount = countStartTokens(tokens, opponent);

  const playerProgress = Object.values(tokens[player]).reduce(
    (sum, position) => sum + getProgressValue(position),
    0
  );
  const opponentProgress = Object.values(tokens[opponent]).reduce(
    (sum, position) => sum + getProgressValue(position),
    0
  );

  const playerVulnerability = estimateVulnerabilityPenalty(tokens, player);
  const opponentVulnerability = estimateVulnerabilityPenalty(tokens, opponent);
  const playerCapturePotential = estimateCapturePotential(tokens, player);
  const opponentCapturePotential = estimateCapturePotential(tokens, opponent);

  return (
    (playerHomeCount - opponentHomeCount) * 720 +
    (playerProgress - opponentProgress) * 22 +
    (opponentStartCount - playerStartCount) * 32 +
    (opponentVulnerability - playerVulnerability) * 0.9 +
    (playerCapturePotential - opponentCapturePotential) * 36
  );
};

const getAiLegalActions = (tokens, player, queueValues) => {
  const actions = [];
  const seenKeys = new Set();

  queueValues.forEach((moveValue, moveIndex) => {
    Object.entries(tokens[player]).forEach(([tokenId, position]) => {
      if (!position || position === HOME) {
        return;
      }

      const availableOptions = getDestinationOptions(position, moveValue);
      availableOptions.forEach((option) => {
        const positionKey = position === START ? `${position}:${tokenId}` : getCellKey(position);
        const actionKey = `${moveIndex}:${positionKey}:${option.position}:${option.useBranch ? '1' : '0'
          }`;
        if (seenKeys.has(actionKey)) {
          return;
        }

        seenKeys.add(actionKey);
        actions.push({
          moveIndex,
          moveValue,
          tokenId,
          option,
          availableOptions,
        });
      });
    });
  });

  return actions;
};

const scoreImmediateAction = (tokensBefore, player, action, moveResult) => {
  if (hasPlayerWon(moveResult.tokens, player)) {
    return WINNING_ACTION_SCORE;
  }

  const opponent = getOpponent(player);
  const homeGain =
    countHomeTokens(moveResult.tokens, player) - countHomeTokens(tokensBefore, player);
  const opponentHomeGain =
    countHomeTokens(moveResult.tokens, opponent) - countHomeTokens(tokensBefore, opponent);
  const startReduction =
    countStartTokens(tokensBefore, player) - countStartTokens(moveResult.tokens, player);
  const captureCount = moveResult.capturedTokenIds.length;
  const movedStackSize = moveResult.movedTokenIds.length;
  const destinationProgress = getProgressValue(action.option.position);

  return (
    captureCount * 950 +
    homeGain * 800 +
    startReduction * 160 +
    movedStackSize * 45 +
    destinationProgress * 14 -
    opponentHomeGain * 500 +
    (action.option.useBranch ? 8 : 0)
  );
};

const evaluateBestQueueOutcome = (tokens, player, queueValues, depthRemaining) => {
  if (hasPlayerWon(tokens, player)) {
    return WINNING_ACTION_SCORE;
  }

  if (depthRemaining <= 0 || queueValues.length === 0) {
    return evaluateBoardState(tokens, player);
  }

  const legalActions = getAiLegalActions(tokens, player, queueValues);
  if (legalActions.length === 0) {
    return evaluateBoardState(tokens, player) - queueValues.length * 40;
  }

  let bestScore = -Infinity;

  legalActions.forEach((action) => {
    const moveResult = applyMove(tokens, player, action.tokenId, action.option.position);
    const remainingQueue = queueValues.filter((_, index) => index !== action.moveIndex);
    const immediateScore = scoreImmediateAction(tokens, player, action, moveResult);
    const futureScore = evaluateBestQueueOutcome(
      moveResult.tokens,
      player,
      remainingQueue,
      depthRemaining - 1
    );
    const totalScore = immediateScore + futureScore * 0.86;

    if (totalScore > bestScore) {
      bestScore = totalScore;
    }
  });

  return bestScore;
};

const chooseBestAiAction = (tokens, player, queueValues) => {
  const legalActions = getAiLegalActions(tokens, player, queueValues);
  if (legalActions.length === 0) {
    return null;
  }

  const lookaheadDepth = Math.min(AI_LOOKAHEAD_DEPTH, queueValues.length);
  let bestAction = null;
  let bestScore = -Infinity;
  let bestImmediateScore = -Infinity;

  legalActions.forEach((action) => {
    const moveResult = applyMove(tokens, player, action.tokenId, action.option.position);
    const remainingQueue = queueValues.filter((_, index) => index !== action.moveIndex);
    const immediateScore = scoreImmediateAction(tokens, player, action, moveResult);
    const continuationScore =
      lookaheadDepth > 1
        ? evaluateBestQueueOutcome(
          moveResult.tokens,
          player,
          remainingQueue,
          lookaheadDepth - 1
        )
        : evaluateBoardState(moveResult.tokens, player);
    const totalScore = immediateScore + continuationScore * 0.86;

    if (
      totalScore > bestScore ||
      (Math.abs(totalScore - bestScore) < 0.001 && immediateScore > bestImmediateScore)
    ) {
      bestAction = action;
      bestScore = totalScore;
      bestImmediateScore = immediateScore;
    }
  });

  return bestAction ?? legalActions[0];
};

function App() {
  const [gameMode, setGameMode] = useState(null);
  const [tokens, setTokens] = useState(() => createInitialTokens());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [moveQueue, setMoveQueue] = useState([]);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [isThrowAnimating, setIsThrowAnimating] = useState(false);
  const [animatedSticks, setAnimatedSticks] = useState(DEFAULT_STICKS);
  const [isThrowResultRevealed, setIsThrowResultRevealed] = useState(false);
  const [throwAllowance, setThrowAllowance] = useState(1);
  const [winner, setWinner] = useState(null);
  const [statusMessage, setStatusMessage] = useState(
    'Choose a mode to start: single-player vs AI or 2-player multiplayer.'
  );
  const [hasCompletedFirstPlayerMove, setHasCompletedFirstPlayerMove] =
    useState(false);
  const [hasTriggeredStackedMoveGuide, setHasTriggeredStackedMoveGuide] =
    useState(false);
  const [requiresStackedMoveChipSelection, setRequiresStackedMoveChipSelection] =
    useState(false);
  const audioContextRef = useRef(null);
  const throwRevealTimeoutRef = useRef(null);
  const throwStickRevealTimeoutRef = useRef(null);
  const throwOverlayStageRef = useRef(null);
  const throwStickRefs = useRef([]);
  const throwSimulationRef = useRef([]);
  const throwAnimationFrameRef = useRef(null);
  const lastAutoAppliedSingleActionRef = useRef(null);
  const aiActionTimeoutRef = useRef(null);
  const winCelebrationTimeoutRef = useRef(null);
  const celebratedWinnerRef = useRef(null);
  const [isCelebratingWin, setIsCelebratingWin] = useState(false);

  const isSinglePlayer = gameMode === GAME_MODES.SINGLE;
  const isAiTurn = isSinglePlayer && currentPlayer === AI_PLAYER_ID;

  const resolvedMoveIndex =
    selectedMoveIndex !== null && selectedMoveIndex < moveQueue.length
      ? selectedMoveIndex
      : moveQueue.length > 0
        ? 0
        : null;

  const pendingMove =
    resolvedMoveIndex === null ? null : moveQueue[resolvedMoveIndex];

  const clearThrowAnimationTimers = useCallback(() => {
    if (throwRevealTimeoutRef.current !== null) {
      window.clearTimeout(throwRevealTimeoutRef.current);
      throwRevealTimeoutRef.current = null;
    }
    if (throwStickRevealTimeoutRef.current !== null) {
      window.clearTimeout(throwStickRevealTimeoutRef.current);
      throwStickRevealTimeoutRef.current = null;
    }
  }, []);

  const clearThrowAnimationFrame = useCallback(() => {
    if (throwAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(throwAnimationFrameRef.current);
      throwAnimationFrameRef.current = null;
    }
  }, []);

  const clearAiActionTimer = useCallback(() => {
    if (aiActionTimeoutRef.current !== null) {
      window.clearTimeout(aiActionTimeoutRef.current);
      aiActionTimeoutRef.current = null;
    }
  }, []);

  const clearWinCelebrationTimer = useCallback(() => {
    if (winCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(winCelebrationTimeoutRef.current);
      winCelebrationTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearThrowAnimationTimers();
      clearThrowAnimationFrame();
      clearAiActionTimer();
      clearWinCelebrationTimer();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
    },
    [
      clearAiActionTimer,
      clearThrowAnimationFrame,
      clearThrowAnimationTimers,
      clearWinCelebrationTimer,
    ]
  );

  useEffect(() => {
    if (!isThrowAnimating) {
      clearThrowAnimationFrame();
      throwSimulationRef.current = [];
      throwStickRefs.current.forEach((element) => {
        if (!element) {
          return;
        }

        element.style.opacity = '';
        element.style.transform = '';
      });
      return;
    }

    const stageElement = throwOverlayStageRef.current;
    if (!stageElement) {
      return undefined;
    }

    const stageWidth = stageElement.clientWidth || 1020;
    const stageHeight = stageElement.clientHeight || 760;
    const simulationDurationSeconds = THROW_STICKS_SETTLE_DURATION_SECONDS;

    throwSimulationRef.current = createThrowPhysicsStates({
      stageWidth,
      stageHeight,
      stickFaces: animatedSticks,
    });

    throwSimulationRef.current.forEach((stickState, index) => {
      applyThrowStickTransform(throwStickRefs.current[index], stickState);
    });

    const startTime = window.performance.now();
    let previousTime = startTime;

    const runFrame = (now) => {
      const elapsedSeconds = (now - startTime) / 1000;
      const deltaSeconds = (now - previousTime) / 1000;
      previousTime = now;
      const shouldFinalize = elapsedSeconds >= simulationDurationSeconds;

      throwSimulationRef.current.forEach((stickState, index) => {
        if (!stickState) {
          return;
        }

        if (shouldFinalize) {
          stickState.x = stickState.landingX;
          stickState.y = 0;
          stickState.angleZ = stickState.targetTilt;
          stickState.angleFlip = stickState.targetFaceRotation;
          stickState.scaleX = 1;
          stickState.scaleY = 1;
          stickState.opacity = 1;
        } else {
          advanceThrowStickState(
            stickState,
            deltaSeconds,
            elapsedSeconds,
            simulationDurationSeconds
          );
        }

        applyThrowStickTransform(throwStickRefs.current[index], stickState);
      });

      if (!shouldFinalize) {
        throwAnimationFrameRef.current = window.requestAnimationFrame(runFrame);
      } else {
        throwAnimationFrameRef.current = null;
      }
    };

    throwAnimationFrameRef.current = window.requestAnimationFrame(runFrame);

    return () => {
      clearThrowAnimationFrame();
    };
  }, [animatedSticks, clearThrowAnimationFrame, isThrowAnimating]);

  const getAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => { });
    }

    return audioContext;
  }, []);

  const playCaptureSound = useCallback(
    (capturedCount) => {
      const audioContext = getAudioContext();
      if (!audioContext || capturedCount <= 0) {
        return;
      }

      const now = audioContext.currentTime + 0.005;
      const pulses = Math.min(capturedCount, 3);

      for (let index = 0; index < pulses; index += 1) {
        const startAt = now + index * 0.07;
        const stopAt = startAt + 0.2;
        const tone = 460 + index * 120;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(tone, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(tone * 1.55, stopAt);

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(stopAt);
      }
    },
    [getAudioContext]
  );

  const playHomeReachedSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime + 0.01;
    const notes = [
      { frequency: 523.25, duration: 0.11 },
      { frequency: 659.25, duration: 0.11 },
      { frequency: 783.99, duration: 0.16 },
    ];

    let cursor = now;
    notes.forEach(({ frequency, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const stopAt = cursor + duration;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, cursor);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.03, stopAt);

      gainNode.gain.setValueAtTime(0.0001, cursor);
      gainNode.gain.exponentialRampToValueAtTime(0.12, cursor + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(cursor);
      oscillator.stop(stopAt);

      cursor += duration * 0.82;
    });
  }, [getAudioContext]);

  const playMoveSelectedSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    const clacks = [
      { offset: 0, frequency: 1380, duration: 0.07, gain: 0.11 },
      { offset: 0.045, frequency: 980, duration: 0.09, gain: 0.1 },
      { offset: 0.095, frequency: 740, duration: 0.12, gain: 0.09 },
    ];

    clacks.forEach(({ offset, frequency, duration, gain }) => {
      const oscillator = audioContext.createOscillator();
      const filter = audioContext.createBiquadFilter();
      const gainNode = audioContext.createGain();
      const startAt = now + offset;
      const stopAt = startAt + duration;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency * 0.9, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.25,
        startAt + duration * 0.35
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(220, frequency * 0.7),
        stopAt
      );

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(frequency, startAt);
      filter.Q.value = 6;

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(startAt);
      oscillator.stop(stopAt);
    });

    const thudOscillator = audioContext.createOscillator();
    const thudGain = audioContext.createGain();
    const thudStart = now + 0.02;
    const thudStop = thudStart + 0.18;

    thudOscillator.type = 'sine';
    thudOscillator.frequency.setValueAtTime(130, thudStart);
    thudOscillator.frequency.exponentialRampToValueAtTime(55, thudStop);

    thudGain.gain.setValueAtTime(0.0001, thudStart);
    thudGain.gain.exponentialRampToValueAtTime(0.08, thudStart + 0.02);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, thudStop);

    thudOscillator.connect(thudGain);
    thudGain.connect(audioContext.destination);

    thudOscillator.start(thudStart);
    thudOscillator.stop(thudStop);
  }, [getAudioContext]);

  const playThrowSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime + 0.01;
    const settleAt = now + THROW_STICKS_SETTLE_DURATION_SECONDS;
    const resolveStart = settleAt - 0.22;
    const noteStep = 0.095 + Math.random() * 0.03;
    const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
    const randomChoice = (items) =>
      items[Math.floor(Math.random() * items.length)];
    const normalizeMidi = (midi, floor, ceiling) => {
      let normalized = midi;
      while (normalized < floor) {
        normalized += 12;
      }
      while (normalized > ceiling) {
        normalized -= 12;
      }
      return normalized;
    };
    const shuffle = (items) => {
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[randomIndex]] = [
          shuffled[randomIndex],
          shuffled[i],
        ];
      }
      return shuffled;
    };

    const harmonicPalettes = [
      { chord: [0, 4, 7, 11], arp: [0, 7, 4, 11, 14, 11, 7, 4] },
      { chord: [0, 3, 7, 10], arp: [0, 7, 3, 10, 12, 10, 7, 3] },
      { chord: [0, 5, 7, 10], arp: [0, 7, 5, 10, 12, 10, 7, 5] },
      { chord: [0, 2, 7, 9], arp: [0, 7, 2, 9, 14, 9, 7, 2] },
      { chord: [0, 4, 9, 11], arp: [0, 9, 4, 11, 16, 11, 9, 4] },
    ];
    const selectedPalette = randomChoice(harmonicPalettes);
    const rootMidi = randomChoice([48, 50, 52, 53, 55, 57, 58, 60, 62]);
    const chordTones = selectedPalette.chord.map((interval) => rootMidi + interval);
    const chordToneOrder = shuffle([0, 1, 2, 3]);

    const voiceBlueprints = [
      { waveform: 'triangle', gain: 0.038, delay: 0, registerOffset: -12 },
      { waveform: 'sine', gain: 0.03, delay: 0.024, registerOffset: -2 },
      { waveform: 'triangle', gain: 0.029, delay: 0.05, registerOffset: 7 },
      { waveform: 'sine', gain: 0.024, delay: 0.078, registerOffset: 14 },
    ];

    const voices = voiceBlueprints.map((blueprint, voiceIndex) => {
      const arpStart = Math.floor(Math.random() * selectedPalette.arp.length);
      const arpDirection = Math.random() < 0.5 ? 1 : -1;
      const arpMidi = Array.from({ length: 8 }, (_, stepIndex) => {
        const sequenceLength = selectedPalette.arp.length;
        const sequenceIndex =
          (arpStart + arpDirection * stepIndex + sequenceLength * 2) % sequenceLength;
        let note =
          rootMidi +
          selectedPalette.arp[sequenceIndex] +
          blueprint.registerOffset;
        if (Math.random() < 0.25) {
          note += randomChoice([-12, 12]);
        }
        return normalizeMidi(note, 40, 94);
      });

      const resolveNote =
        chordTones[chordToneOrder[voiceIndex]] + blueprint.registerOffset;
      return {
        waveform: blueprint.waveform,
        gain: blueprint.gain,
        delay: blueprint.delay,
        arpMidi,
        resolveMidi: normalizeMidi(resolveNote, 40, 94),
      };
    });

    voices.forEach((voice) => {
      const voiceFilter = audioContext.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      const filterStart = randomChoice([1800, 2000, 2200, 2400]);
      const filterEnd = randomChoice([1200, 1320, 1450, 1600]);
      voiceFilter.frequency.setValueAtTime(filterStart, now);
      voiceFilter.frequency.exponentialRampToValueAtTime(filterEnd, settleAt);
      voiceFilter.Q.value = 0.58 + Math.random() * 0.28;
      voiceFilter.connect(audioContext.destination);

      let cursor = now + voice.delay;
      let noteIndex = 0;

      while (cursor + noteStep < resolveStart) {
        const noteStart = cursor;
        const noteStop = noteStart + noteStep * 0.9;
        const midiNote = voice.arpMidi[noteIndex % voice.arpMidi.length];
        const frequency = midiToFrequency(midiNote);
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = voice.waveform;
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.01,
          noteStop
        );

        gainNode.gain.setValueAtTime(0.0001, noteStart);
        gainNode.gain.exponentialRampToValueAtTime(voice.gain, noteStart + 0.018);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStop);

        oscillator.connect(gainNode);
        gainNode.connect(voiceFilter);
        oscillator.start(noteStart);
        oscillator.stop(noteStop);

        noteIndex += 1;
        cursor += noteStep;
      }

      const resolveOscillator = audioContext.createOscillator();
      const resolveGain = audioContext.createGain();
      const resolveStop = settleAt + (0.23 + Math.random() * 0.08);
      const resolveFrequency = midiToFrequency(voice.resolveMidi);

      resolveOscillator.type = voice.waveform;
      resolveOscillator.frequency.setValueAtTime(resolveFrequency, resolveStart);
      resolveOscillator.frequency.exponentialRampToValueAtTime(
        resolveFrequency * 0.998,
        resolveStop
      );

      resolveGain.gain.setValueAtTime(0.0001, resolveStart);
      resolveGain.gain.exponentialRampToValueAtTime(voice.gain * 1.2, settleAt);
      resolveGain.gain.exponentialRampToValueAtTime(0.0001, resolveStop);

      resolveOscillator.connect(resolveGain);
      resolveGain.connect(voiceFilter);
      resolveOscillator.start(resolveStart);
      resolveOscillator.stop(resolveStop);
    });
  }, [getAudioContext]);

  const playVictorySound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime + 0.02;
    const notes = [
      { frequency: 392.0, duration: 0.16 },
      { frequency: 523.25, duration: 0.16 },
      { frequency: 659.25, duration: 0.18 },
      { frequency: 783.99, duration: 0.2 },
      { frequency: 1046.5, duration: 0.3 },
    ];

    let cursor = now;
    notes.forEach(({ frequency, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const stopAt = cursor + duration;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, cursor);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.04, stopAt);

      gainNode.gain.setValueAtTime(0.0001, cursor);
      gainNode.gain.exponentialRampToValueAtTime(0.16, cursor + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(cursor);
      oscillator.stop(stopAt);

      cursor += duration * 0.82;
    });

    const chordStart = cursor - 0.02;
    const chordStop = chordStart + 0.48;
    [523.25, 659.25, 783.99].forEach((frequency) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, chordStart);
      gainNode.gain.setValueAtTime(0.0001, chordStart);
      gainNode.gain.exponentialRampToValueAtTime(0.085, chordStart + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, chordStop);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(chordStart);
      oscillator.stop(chordStop);
    });
  }, [getAudioContext]);

  const resetGameForMode = useCallback(
    (mode) => {
      clearThrowAnimationTimers();
      clearThrowAnimationFrame();
      clearAiActionTimer();
      setGameMode(mode);
      setTokens(createInitialTokens());
      setCurrentPlayer(1);
      setMoveQueue([]);
      setSelectedMoveIndex(null);
      setSelectedTokenId(null);
      setIsThrowAnimating(false);
      setIsThrowResultRevealed(false);
      setAnimatedSticks(DEFAULT_STICKS);
      setThrowAllowance(1);
      setWinner(null);
      setIsCelebratingWin(false);
      setHasCompletedFirstPlayerMove(false);
      setHasTriggeredStackedMoveGuide(false);
      setRequiresStackedMoveChipSelection(false);
      celebratedWinnerRef.current = null;
      clearWinCelebrationTimer();
      setStatusMessage(
        mode === GAME_MODES.SINGLE
          ? 'Single-player mode started. You are Red; AI is Blue. Throw the sticks.'
          : 'Multiplayer mode started. Red begins. Throw the sticks.'
      );
    },
    [
      clearAiActionTimer,
      clearThrowAnimationFrame,
      clearThrowAnimationTimers,
      clearWinCelebrationTimer,
    ]
  );

  const getMovableTokenIds = useCallback(
    (player, moveValue) => {
      if (winner !== null || moveValue === null) {
        return [];
      }

      return Object.entries(tokens[player])
        .filter(([, position]) => position && position !== HOME)
        .filter(([, position]) =>
          getDestinationOptions(position, moveValue).length > 0
        )
        .map(([tokenId]) => tokenId);
    },
    [tokens, winner]
  );

  const selectedTokenDestinationOptions = useMemo(() => {
    if (winner !== null || pendingMove === null || selectedTokenId === null) {
      return [];
    }
    const selectedPosition = tokens[currentPlayer][selectedTokenId];
    if (!selectedPosition || selectedPosition === HOME) {
      return [];
    }
    return getDestinationOptions(selectedPosition, pendingMove);
  }, [winner, pendingMove, selectedTokenId, tokens, currentPlayer]);

  const startDestinationOptions = useMemo(() => {
    if (
      winner !== null ||
      pendingMove === null ||
      selectedTokenId !== null ||
      isAiTurn ||
      hasTokenOnCourse(tokens, currentPlayer)
    ) {
      return [];
    }

    return getDestinationOptions(START, pendingMove);
  }, [currentPlayer, isAiTurn, pendingMove, selectedTokenId, tokens, winner]);

  const autoCaptureMoves = useMemo(() => {
    if (
      winner !== null ||
      pendingMove === null ||
      selectedTokenId !== null ||
      isAiTurn ||
      !hasTokenOnCourse(tokens, currentPlayer)
    ) {
      return [];
    }

    const opponent = getOpponent(currentPlayer);
    const opponentOccupiedCells = new Set(
      Object.values(tokens[opponent])
        .filter((position) => position && position !== START && position !== HOME)
        .map((position) => getCellKey(position))
    );

    if (opponentOccupiedCells.size === 0) {
      return [];
    }

    const moveCandidatesByDestination = new Map();
    Object.entries(tokens[currentPlayer]).forEach(([tokenId, position]) => {
      if (!position || position === START || position === HOME) {
        return;
      }

      const originCellKey = getCellKey(position);
      const tokenOptions = getDestinationOptions(position, pendingMove);

      tokenOptions.forEach((option) => {
        if (!option.position || option.position === START || option.position === HOME) {
          return;
        }

        const destinationCellKey = getCellKey(option.position);
        if (!opponentOccupiedCells.has(destinationCellKey)) {
          return;
        }

        const optionKey = getDestinationOptionKey(option);
        const existingEntry = moveCandidatesByDestination.get(optionKey) ?? {
          option,
          origins: new Map(),
        };

        if (!existingEntry.origins.has(originCellKey)) {
          existingEntry.origins.set(originCellKey, {
            tokenId,
            availableOptions: tokenOptions,
          });
        }

        moveCandidatesByDestination.set(optionKey, existingEntry);
      });
    });

    const guaranteedCaptureMoves = [];
    moveCandidatesByDestination.forEach((entry) => {
      if (entry.origins.size !== 1) {
        return;
      }

      const [{ tokenId, availableOptions }] = Array.from(entry.origins.values());
      guaranteedCaptureMoves.push({
        option: entry.option,
        tokenId,
        availableOptions,
      });
    });

    return guaranteedCaptureMoves;
  }, [currentPlayer, isAiTurn, pendingMove, selectedTokenId, tokens, winner]);

  const autoCaptureMoveByDestination = useMemo(
    () =>
      autoCaptureMoves.reduce((movesByDestination, move) => {
        movesByDestination[getDestinationOptionKey(move.option)] = move;
        return movesByDestination;
      }, {}),
    [autoCaptureMoves]
  );

  const autoCaptureDestinationOptions = useMemo(
    () => autoCaptureMoves.map((move) => move.option),
    [autoCaptureMoves]
  );

  const destinationOptions =
    selectedTokenDestinationOptions.length > 0
      ? selectedTokenDestinationOptions
      : startDestinationOptions.length > 0
        ? startDestinationOptions
        : autoCaptureDestinationOptions;

  const movableTokenIds = useMemo(() => {
    if (
      winner !== null ||
      pendingMove === null ||
      isAiTurn ||
      isThrowAnimating ||
      requiresStackedMoveChipSelection
    ) {
      return [];
    }

    return getMovableTokenIds(currentPlayer, pendingMove);
  }, [
    currentPlayer,
    getMovableTokenIds,
    isAiTurn,
    isThrowAnimating,
    pendingMove,
    requiresStackedMoveChipSelection,
    winner,
  ]);

  const singleLegalAction = useMemo(() => {
    if (winner !== null || pendingMove === null) {
      return null;
    }

    let forcedAction = null;
    let legalActionCount = 0;

    for (const [tokenId, position] of Object.entries(tokens[currentPlayer])) {
      if (!position || position === HOME) {
        continue;
      }

      const availableOptions = getDestinationOptions(position, pendingMove);
      for (const option of availableOptions) {
        legalActionCount += 1;
        if (legalActionCount > 1) {
          return null;
        }

        forcedAction = {
          tokenId,
          option,
          availableOptions,
        };
      }
    }

    return legalActionCount === 1 ? forcedAction : null;
  }, [currentPlayer, pendingMove, tokens, winner]);

  useEffect(() => {
    if (winner !== null || isThrowAnimating || isAiTurn || moveQueue.length <= 1) {
      if (requiresStackedMoveChipSelection) {
        setRequiresStackedMoveChipSelection(false);
      }
      return;
    }

    if (!hasTriggeredStackedMoveGuide) {
      setHasTriggeredStackedMoveGuide(true);
      setRequiresStackedMoveChipSelection(true);
    }
  }, [
    hasTriggeredStackedMoveGuide,
    isAiTurn,
    isThrowAnimating,
    moveQueue.length,
    requiresStackedMoveChipSelection,
    winner,
  ]);

  useEffect(() => {
    if (winner === null) {
      setIsCelebratingWin(false);
      celebratedWinnerRef.current = null;
      clearWinCelebrationTimer();
      return;
    }

    if (celebratedWinnerRef.current === winner) {
      return;
    }

    celebratedWinnerRef.current = winner;
    setIsCelebratingWin(true);
    playVictorySound();
    clearWinCelebrationTimer();
    winCelebrationTimeoutRef.current = window.setTimeout(() => {
      setIsCelebratingWin(false);
    }, VICTORY_CELEBRATION_DURATION_MS);
  }, [clearWinCelebrationTimer, playVictorySound, winner]);

  useEffect(() => {
    if (
      gameMode === null ||
      isAiTurn ||
      winner !== null ||
      isThrowAnimating ||
      pendingMove === null
    ) {
      return;
    }

    const movableTokenIds = getMovableTokenIds(currentPlayer, pendingMove);
    if (movableTokenIds.length !== 1) {
      if (
        selectedTokenId !== null &&
        !movableTokenIds.includes(selectedTokenId)
      ) {
        setSelectedTokenId(null);
      }
      return;
    }

    const [onlyTokenId] = movableTokenIds;
    if (selectedTokenId !== onlyTokenId) {
      setSelectedTokenId(onlyTokenId);
    }
  }, [
    currentPlayer,
    gameMode,
    getMovableTokenIds,
    isAiTurn,
    isThrowAnimating,
    pendingMove,
    selectedTokenId,
    winner,
  ]);

  const throwYut = useCallback(() => {
    if (
      throwAllowance <= 0 ||
      winner !== null ||
      isThrowAnimating ||
      gameMode === null
    ) {
      return;
    }

    getAudioContext();

    const throwResult = rollThrow();
    const activePlayer = currentPlayer;

    clearThrowAnimationTimers();
    clearThrowAnimationFrame();
    setIsThrowAnimating(true);
    setIsThrowResultRevealed(false);
    setAnimatedSticks(throwResult.sticks);
    playThrowSound();
    setStatusMessage(
      `${getPlayerName(activePlayer)} is throwing the sticks...`
    );

    throwStickRevealTimeoutRef.current = window.setTimeout(() => {
      setIsThrowResultRevealed(true);
      throwStickRevealTimeoutRef.current = null;
    }, THROW_STICKS_SETTLE_DURATION_MS);

    throwRevealTimeoutRef.current = window.setTimeout(() => {
      const hasCourseToken = hasTokenOnCourse(tokens, activePlayer);
      const isBackDoWithoutCourseToken = throwResult.value === -1 && !hasCourseToken;
      const shouldTreatBackDoAsDo =
        isBackDoWithoutCourseToken && BACK_DO_EMPTY_BOARD_RULE === 'do';
      const shouldSkipBackDo =
        isBackDoWithoutCourseToken && BACK_DO_EMPTY_BOARD_RULE === 'skip';
      const queuedValue = shouldTreatBackDoAsDo ? 1 : throwResult.value;
      const nextQueueLength = shouldSkipBackDo ? moveQueue.length : moveQueue.length + 1;
      const queueStrategyHint =
        nextQueueLength > 1
          ? ' Choose your desired pending move first before placing or moving a mal for optimal strategy.'
          : '';
      const nextThrowAllowance =
        Math.max(0, throwAllowance - 1) + (throwResult.extraTurn ? 1 : 0);

      clearThrowAnimationTimers();
      setIsThrowResultRevealed(true);
      setMoveQueue((previousQueue) =>
        shouldSkipBackDo ? previousQueue : [...previousQueue, queuedValue]
      );
      setSelectedMoveIndex((previousIndex) => {
        if (previousIndex !== null || shouldSkipBackDo) {
          return previousIndex;
        }
        return 0;
      });
      setIsThrowAnimating(false);

      if (shouldSkipBackDo && moveQueue.length === 0 && nextThrowAllowance === 0) {
        const nextPlayer = getOpponent(activePlayer);
        setCurrentPlayer(nextPlayer);
        setThrowAllowance(1);
        setStatusMessage(
          `No mal is on the board, so this Back Do is skipped. Turn passes to ${getPlayerName(nextPlayer)}.`
        );
        return;
      }

      setThrowAllowance(nextThrowAllowance);
      const movableTokenIds = shouldSkipBackDo
        ? []
        : getMovableTokenIds(activePlayer, queuedValue);
      setStatusMessage(
        shouldSkipBackDo
          ? `No mal is on the board, so this Back Do is skipped.${queueStrategyHint}`
          : throwResult.extraTurn
            ? `Bonus throw earned.${queueStrategyHint}`
            : shouldTreatBackDoAsDo
              ? `No mal is on the board, so this Back Do is treated as a Do.${queueStrategyHint}`
              : movableTokenIds.length === 1
                ? `One legal move is available.${queueStrategyHint}`
                : !hasCourseToken
                  ? `Select a station to place a mal.${queueStrategyHint}`
                  : `Select a mal to move.${queueStrategyHint}`
      );
    }, THROW_TOTAL_DURATION_MS);
  }, [
    clearThrowAnimationFrame,
    clearThrowAnimationTimers,
    currentPlayer,
    gameMode,
    getAudioContext,
    getMovableTokenIds,
    isThrowAnimating,
    moveQueue,
    playThrowSound,
    tokens,
    throwAllowance,
    winner,
  ]);

  const applySelectedMove = useCallback(
    ({ option, tokenId, moveIndex, availableOptions }) => {
      if (
        winner !== null ||
        isThrowAnimating ||
        pendingMove === null ||
        tokenId === null ||
        moveIndex === null
      ) {
        return;
      }

      const isAllowedOption = availableOptions.some(
        (destinationOption) =>
          destinationOption.position === option.position &&
          destinationOption.useBranch === option.useBranch
      );

      if (!isAllowedOption) {
        return;
      }

      const moveResult = applyMove(
        tokens,
        currentPlayer,
        tokenId,
        option.position
      );
      const remainingQueue = moveQueue.filter((_, index) => index !== moveIndex);
      const capturedCount = moveResult.capturedTokenIds.length;
      const nextThrowAllowance = throwAllowance + (capturedCount > 0 ? 1 : 0);
      const canThrowAgain = nextThrowAllowance > 0;

      if (option.position === HOME) {
        playHomeReachedSound();
      } else if (capturedCount > 0) {
        playCaptureSound(capturedCount);
      } else {
        playMoveSelectedSound();
      }

      setTokens(moveResult.tokens);
      setMoveQueue(remainingQueue);
      setSelectedMoveIndex(remainingQueue.length > 0 ? 0 : null);
      setSelectedTokenId(null);
      if (currentPlayer === 1 && !hasCompletedFirstPlayerMove) {
        setHasCompletedFirstPlayerMove(true);
      }

      if (hasPlayerWon(moveResult.tokens, currentPlayer)) {
        setMoveQueue([]);
        setSelectedMoveIndex(null);
        setWinner(currentPlayer);
        setThrowAllowance(0);
        setStatusMessage(
          `${getPlayerName(currentPlayer)} wins by bringing all mals home.`
        );
        return;
      }

      const movedCount = moveResult.movedTokenIds.length;
      const movedText =
        option.position === HOME ? 'reached home' : 'moved on the board';
      const captureText =
        capturedCount > 0
          ? ` Captured ${capturedCount} opponent mal${capturedCount > 1 ? 's' : ''
          }.`
          : '';

      if (remainingQueue.length === 0 && !canThrowAgain) {
        const nextPlayer = getOpponent(currentPlayer);
        setCurrentPlayer(nextPlayer);
        setThrowAllowance(1);
        setStatusMessage(
          `${getPlayerName(currentPlayer)} ${movedText} with ${movedCount} mal${movedCount > 1 ? 's' : ''
          }.${captureText} Turn passes to ${getPlayerName(nextPlayer)}.`
        );
        return;
      }

      setThrowAllowance(nextThrowAllowance);
      const queueStrategyHint =
        remainingQueue.length > 1
          ? ' Choose your desired pending move first before placing or moving a mal for optimal strategy.'
          : '';
      setStatusMessage(
        `${getPlayerName(currentPlayer)} ${movedText} with ${movedCount} mal${movedCount > 1 ? 's' : ''
        }.${captureText}${canThrowAgain
          ? ' You may throw again or use another queued move.'
          : ' Use another queued move.'
        }${queueStrategyHint}`
      );
    },
    [
      currentPlayer,
      hasCompletedFirstPlayerMove,
      isThrowAnimating,
      moveQueue,
      pendingMove,
      playCaptureSound,
      playHomeReachedSound,
      playMoveSelectedSound,
      throwAllowance,
      tokens,
      winner,
    ]
  );

  useEffect(() => {
    if (
      gameMode === null ||
      isAiTurn ||
      winner !== null ||
      isThrowAnimating ||
      resolvedMoveIndex === null ||
      requiresStackedMoveChipSelection ||
      singleLegalAction === null
    ) {
      lastAutoAppliedSingleActionRef.current = null;
      return;
    }

    const singleActionKey = [
      currentPlayer,
      resolvedMoveIndex,
      pendingMove,
      singleLegalAction.tokenId,
      getDestinationOptionKey(singleLegalAction.option),
    ].join(':');

    if (lastAutoAppliedSingleActionRef.current === singleActionKey) {
      return;
    }

    lastAutoAppliedSingleActionRef.current = singleActionKey;
    applySelectedMove({
      option: singleLegalAction.option,
      tokenId: singleLegalAction.tokenId,
      moveIndex: resolvedMoveIndex,
      availableOptions: singleLegalAction.availableOptions,
    });
  }, [
    applySelectedMove,
    currentPlayer,
    gameMode,
    isAiTurn,
    isThrowAnimating,
    pendingMove,
    requiresStackedMoveChipSelection,
    resolvedMoveIndex,
    singleLegalAction,
    winner,
  ]);

  useEffect(() => {
    clearAiActionTimer();

    if (
      gameMode !== GAME_MODES.SINGLE ||
      !isAiTurn ||
      winner !== null ||
      isThrowAnimating
    ) {
      return undefined;
    }

    aiActionTimeoutRef.current = window.setTimeout(() => {
      if (throwAllowance > 0) {
        throwYut();
        return;
      }

      if (moveQueue.length === 0) {
        return;
      }

      const bestAction = chooseBestAiAction(tokens, AI_PLAYER_ID, moveQueue);
      if (!bestAction) {
        return;
      }

      applySelectedMove({
        option: bestAction.option,
        tokenId: bestAction.tokenId,
        moveIndex: bestAction.moveIndex,
        availableOptions: bestAction.availableOptions,
      });
    }, AI_ACTION_DELAY_MS);

    return clearAiActionTimer;
  }, [
    applySelectedMove,
    clearAiActionTimer,
    gameMode,
    isAiTurn,
    isThrowAnimating,
    moveQueue,
    throwAllowance,
    throwYut,
    tokens,
    winner,
  ]);

  const handleSelectToken = useCallback(
    (tokenId) => {
      if (
        gameMode === null ||
        isAiTurn ||
        winner !== null ||
        isThrowAnimating ||
        pendingMove === null ||
        requiresStackedMoveChipSelection
      ) {
        return;
      }
      const tokenPosition = tokens[currentPlayer][tokenId];
      if (!tokenPosition || tokenPosition === HOME) {
        return;
      }

      const tokenDestinationOptions = getDestinationOptions(tokenPosition, pendingMove);
      const hasOnlyHomeDestination =
        tokenDestinationOptions.length === 1 &&
        tokenDestinationOptions[0].position === HOME &&
        resolvedMoveIndex !== null;

      if (hasOnlyHomeDestination) {
        applySelectedMove({
          option: tokenDestinationOptions[0],
          tokenId,
          moveIndex: resolvedMoveIndex,
          availableOptions: tokenDestinationOptions,
        });
        return;
      }

      setSelectedTokenId(tokenId);
    },
    [
      applySelectedMove,
      currentPlayer,
      gameMode,
      isAiTurn,
      isThrowAnimating,
      pendingMove,
      requiresStackedMoveChipSelection,
      resolvedMoveIndex,
      tokens,
      winner,
    ]
  );

  const handleSelectDestination = useCallback(
    (option) => {
      if (
        gameMode === null ||
        isAiTurn ||
        resolvedMoveIndex === null ||
        requiresStackedMoveChipSelection
      ) {
        return;
      }

      if (selectedTokenId === null) {
        const hasCourseToken = hasTokenOnCourse(tokens, currentPlayer);
        if (hasCourseToken) {
          const autoCaptureMove =
            autoCaptureMoveByDestination[getDestinationOptionKey(option)];
          if (!autoCaptureMove) {
            return;
          }

          applySelectedMove({
            option: autoCaptureMove.option,
            tokenId: autoCaptureMove.tokenId,
            moveIndex: resolvedMoveIndex,
            availableOptions: autoCaptureMove.availableOptions,
          });
          return;
        }

        const startTokenId =
          Object.entries(tokens[currentPlayer]).find(
            ([, position]) => position === START
          )?.[0] ?? null;

        if (startTokenId === null) {
          return;
        }

        applySelectedMove({
          option,
          tokenId: startTokenId,
          moveIndex: resolvedMoveIndex,
          availableOptions: startDestinationOptions,
        });
        return;
      }

      applySelectedMove({
        option,
        tokenId: selectedTokenId,
        moveIndex: resolvedMoveIndex,
        availableOptions: selectedTokenDestinationOptions,
      });
    },
    [
      applySelectedMove,
      autoCaptureMoveByDestination,
      currentPlayer,
      gameMode,
      isAiTurn,
      requiresStackedMoveChipSelection,
      resolvedMoveIndex,
      selectedTokenId,
      selectedTokenDestinationOptions,
      startDestinationOptions,
      tokens,
    ]
  );

  const isGuidingFirstPlayerOpeningTurn =
    gameMode !== null &&
    winner === null &&
    !isThrowAnimating &&
    !isAiTurn &&
    currentPlayer === 1 &&
    !hasCompletedFirstPlayerMove;
  const isChoosingFromStartOnly = !hasTokenOnCourse(tokens, currentPlayer);
  const shouldGuideThrowStep =
    isGuidingFirstPlayerOpeningTurn &&
    throwAllowance > 0 &&
    moveQueue.length === 0;
  const shouldGuideMoveQueueStep =
    requiresStackedMoveChipSelection &&
    winner === null &&
    !isThrowAnimating &&
    !isAiTurn &&
    moveQueue.length > 1;
  const shouldGuideTokenSelectionStep =
    !shouldGuideMoveQueueStep &&
    isGuidingFirstPlayerOpeningTurn &&
    pendingMove !== null &&
    selectedTokenId === null;
  const shouldGuideDestinationStep =
    !shouldGuideMoveQueueStep &&
    isGuidingFirstPlayerOpeningTurn &&
    pendingMove !== null &&
    destinationOptions.length > 0 &&
    (selectedTokenId !== null || isChoosingFromStartOnly);

  const shouldHighlightStartTokens =
    shouldGuideTokenSelectionStep && isChoosingFromStartOnly;
  const isGuideActive =
    shouldGuideThrowStep ||
    shouldGuideMoveQueueStep ||
    shouldGuideTokenSelectionStep ||
    shouldGuideDestinationStep;

  const gameTitle = (
    <h1 className="game-title">
      <a
        href="https://en.wikipedia.org/wiki/Yunnori"
        target="_blank"
        rel="noreferrer"
      >
        Yutnori
      </a>{' '}
      by{' '}
      <a
        href="https://www.instagram.com/akinhwan"
        target="_blank"
        rel="noreferrer"
      >
        @akinhwan
      </a>
    </h1>
  );

  if (gameMode === null) {
    return (
      <div className={`App ${isGuideActive ? 'ui-guide-active' : ''}`}>
        <div className="control-panel control-panel-mode-select">
          {gameTitle}
          <div className="welcome-brief" aria-label="Quick Yutnori rules">
            <p className="welcome-brief-title">Welcome. Quick Rules:</p>
            <ul className="welcome-brief-list">
              <li>Teams take turns throwing 4 sticks.</li>
              <li>Move one mal per score: Back Do -1, Do 1, Gae 2, Geol 3, Yut 4, Mo 5.</li>
              <li>The marked Back stick down alone gives Back Do and moves one step backward.</li>
              <li>Yut/Mo grants an extra throw; queue scores, but each score is one whole move.</li>
              <li>Land on enemy: capture and throw again. Land on own: stack and move together.</li>
              <li>Win by getting all mals home; pass start to finish, exact landing not required.</li>
            </ul>
          </div>
          <p className="status-message">
            Choose whether you want to play single-player (vs AI) or multiplayer.
          </p>
          <div className="mode-choice-row">
            <button
              type="button"
              className="throw-button mode-choice-button"
              onClick={() => resetGameForMode(GAME_MODES.SINGLE)}
            >
              Single Player (vs AI)
            </button>
            <button
              type="button"
              className="throw-button mode-choice-button"
              onClick={() => resetGameForMode(GAME_MODES.MULTI)}
            >
              Multiplayer (2 Players)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`App ${isGuideActive ? 'ui-guide-active' : ''}`}>
      {isGuideActive ? <div className="ui-guide-overlay" aria-hidden="true" /> : null}
      <div
        className={`control-panel control-panel-player-${winner ?? currentPlayer
          } ${winner !== null && isCelebratingWin ? 'control-panel-victory' : ''}`}
      >
        {gameTitle}

        {/* <p className="mode-indicator">
          {isSinglePlayer
            ? 'Mode: Single Player (You vs AI)'
            : 'Mode: Multiplayer (2 Players)'}
        </p> */}

        {winner !== null ? (
          <div
            className={`victory-banner victory-banner-player-${winner} ${isCelebratingWin ? 'victory-banner-active' : ''
              }`}
            role="status"
            aria-live="polite"
          >
            {PLAYER_LABELS[winner]} wins. All mals are home.
          </div>
        ) : null}

        <p className="status-message">
          {splitStatusMessage(statusMessage).map((sentence, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`${sentence}-${index}`}
              className="status-message-line"
            >
              {sentence}
            </span>
          ))}
        </p>

        <div className="control-row">
          <button
            type="button"
            className={`throw-button throw-button-primary ${throwAllowance > 0 &&
                winner === null &&
                !isThrowAnimating &&
                !isAiTurn
                ? 'throw-button-next'
                : ''
              } ${shouldGuideThrowStep ? 'ui-guide-spotlight' : ''}`}
            onClick={throwYut}
            disabled={
              throwAllowance <= 0 || winner !== null || isThrowAnimating || isAiTurn
            }
          >
            Throw Yut Sticks
          </button>
        </div>

        {moveQueue.length > 0 ? (
          <>
            <p className="pending-move">
              Pending move:
            </p>
            <div
              className={`move-queue ${shouldGuideMoveQueueStep ? 'move-queue-guided' : ''
                }`}
              role="group"
              aria-label="Queued moves"
            >
              {moveQueue.map((moveValue, index) => (
                <button
                  type="button"
                  key={`move-queue-${index}-${moveValue}`}
                  className={`move-chip ${resolvedMoveIndex === index ? 'move-chip-selected' : ''
                    } ${shouldGuideMoveQueueStep ? 'ui-guide-spotlight' : ''}`}
                  onClick={() => {
                    playMoveSelectedSound();
                    setSelectedMoveIndex(index);
                    setSelectedTokenId(null);
                    setRequiresStackedMoveChipSelection(false);
                  }}
                  disabled={winner !== null || isThrowAnimating || isAiTurn}
                  aria-pressed={resolvedMoveIndex === index}
                >
                  {describeThrow(moveValue)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="pending-move queue-empty">No queued moves.</p>
        )}

      </div>

      <Board
        tokens={tokens}
        currentPlayer={currentPlayer}
        selectedTokenId={selectedTokenId}
        pendingMove={pendingMove}
        shouldHighlightStartTokens={shouldHighlightStartTokens}
        shouldGuideTokenSelection={shouldGuideTokenSelectionStep}
        shouldGuideDestinationSelection={shouldGuideDestinationStep}
        destinationOptions={destinationOptions}
        movableTokenIds={movableTokenIds}
        onTokenSelect={handleSelectToken}
        onDestinationSelect={handleSelectDestination}
      />

      {winner !== null ? (
        <div
          className={`victory-confetti-layer ${isCelebratingWin ? 'victory-confetti-layer-active' : ''
            }`}
          aria-hidden="true"
        >
          {Array.from({ length: 24 }, (_, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`confetti-${index}`}
              className="confetti-piece"
              style={{
                '--confetti-index': index,
                '--confetti-hue': `${(index * 37) % 360}`,
              }}
            />
          ))}
        </div>
      ) : null}

      {isThrowAnimating ? (
        <div
          className="throw-overlay"
          role="status"
          aria-live="polite"
          aria-label="Throwing Yut sticks"
        >
          <div className="throw-overlay-stage" ref={throwOverlayStageRef}>
            {animatedSticks.map((stickFace, index) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`throw-stick-${index}`}
                ref={(element) => {
                  throwStickRefs.current[index] = element;
                }}
                className={`throw-stick ${stickFace === 'flat' ? 'throw-stick-flat' : 'throw-stick-round'
                  } ${isThrowResultRevealed ? '' : 'throw-stick-unrevealed'} ${index === BACK_STICK_INDEX ? 'throw-stick-back' : ''
                  }`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
