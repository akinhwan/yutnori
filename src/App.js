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
const THROW_IN_AIR_DURATION_MS = 1200;
const THROW_LANDING_DISPLAY_MS = 780;
const THROW_TOTAL_DURATION_MS =
  THROW_IN_AIR_DURATION_MS + THROW_LANDING_DISPLAY_MS;
const AI_ACTION_DELAY_MS = 550;
const AI_LOOKAHEAD_DEPTH = 4;
const WINNING_ACTION_SCORE = 1_000_000;
const VICTORY_CELEBRATION_DURATION_MS = 4200;

const randomBetween = (min, max) => min + Math.random() * (max - min);

const createThrowTrajectories = () =>
  Array.from({ length: 4 }, (_, index) => {
    const landingRow = [-198, -66, 66, 198];
    const laneX = -180 + index * 120;
    return {
      startX: Math.round(laneX + randomBetween(-70, 70)),
      peakX: Math.round(laneX * 0.55 + randomBetween(-110, 110)),
      endX: landingRow[index],
      tilt: Math.round(randomBetween(-34, 34)),
      delay: Math.round(randomBetween(0, 120)),
      duration: Math.round(randomBetween(1020, 1180)),
      peakY: `${Math.round(randomBetween(40, 52))}vh`,
      dropY: `${Math.round(randomBetween(16, 24))}vh`,
      spins: Math.round(randomBetween(540, 860)),
    };
  });

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
  const [throwTrajectories, setThrowTrajectories] = useState(() =>
    createThrowTrajectories()
  );
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
      clearAiActionTimer();
      clearWinCelebrationTimer();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
    },
    [clearAiActionTimer, clearThrowAnimationTimers, clearWinCelebrationTimer]
  );

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
    const clacks = [
      { offset: 0.0, freqA: 1450, freqB: 930, gain: 0.13, duration: 0.06 },
      { offset: 0.07, freqA: 1280, freqB: 860, gain: 0.12, duration: 0.07 },
      { offset: 0.14, freqA: 1180, freqB: 760, gain: 0.11, duration: 0.08 },
      { offset: 0.22, freqA: 980, freqB: 680, gain: 0.1, duration: 0.09 },
    ];

    clacks.forEach(({ offset, freqA, freqB, gain, duration }) => {
      const startAt = now + offset;
      const stopAt = startAt + duration;

      const oscillatorA = audioContext.createOscillator();
      const oscillatorB = audioContext.createOscillator();
      const bandpass = audioContext.createBiquadFilter();
      const gainNode = audioContext.createGain();

      oscillatorA.type = 'triangle';
      oscillatorB.type = 'square';
      oscillatorA.frequency.setValueAtTime(freqA, startAt);
      oscillatorB.frequency.setValueAtTime(freqB, startAt);
      oscillatorA.frequency.exponentialRampToValueAtTime(
        Math.max(220, freqA * 0.55),
        stopAt
      );
      oscillatorB.frequency.exponentialRampToValueAtTime(
        Math.max(180, freqB * 0.5),
        stopAt
      );

      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime((freqA + freqB) * 0.5, startAt);
      bandpass.Q.value = 8;

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.009);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillatorA.connect(bandpass);
      oscillatorB.connect(bandpass);
      bandpass.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillatorA.start(startAt);
      oscillatorB.start(startAt);
      oscillatorA.stop(stopAt);
      oscillatorB.stop(stopAt);
    });

    const noiseBuffer = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.8),
      audioContext.sampleRate
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.7;
    }

    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2200, now + 0.22);
    lowpass.frequency.exponentialRampToValueAtTime(620, now + 0.75);

    const tumbleGain = audioContext.createGain();
    tumbleGain.gain.setValueAtTime(0.0001, now + 0.2);
    tumbleGain.gain.exponentialRampToValueAtTime(0.055, now + 0.32);
    tumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);

    noiseSource.connect(lowpass);
    lowpass.connect(tumbleGain);
    tumbleGain.connect(audioContext.destination);
    noiseSource.start(now + 0.2);
    noiseSource.stop(now + 0.8);

    const thud = audioContext.createOscillator();
    const thudGain = audioContext.createGain();
    const thudStart = now + 0.6;
    const thudStop = thudStart + 0.22;

    thud.type = 'sine';
    thud.frequency.setValueAtTime(175, thudStart);
    thud.frequency.exponentialRampToValueAtTime(62, thudStop);
    thudGain.gain.setValueAtTime(0.0001, thudStart);
    thudGain.gain.exponentialRampToValueAtTime(0.08, thudStart + 0.03);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, thudStop);

    thud.connect(thudGain);
    thudGain.connect(audioContext.destination);
    thud.start(thudStart);
    thud.stop(thudStop);
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
      clearAiActionTimer();
      setGameMode(mode);
      setTokens(createInitialTokens());
      setCurrentPlayer(1);
      setMoveQueue([]);
      setSelectedMoveIndex(null);
      setSelectedTokenId(null);
      setIsThrowAnimating(false);
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
    [clearAiActionTimer, clearThrowAnimationTimers, clearWinCelebrationTimer]
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

  const destinationOptions =
    selectedTokenDestinationOptions.length > 0
      ? selectedTokenDestinationOptions
      : startDestinationOptions;

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
    setIsThrowAnimating(true);
    setAnimatedSticks(throwResult.sticks);
    setThrowTrajectories(createThrowTrajectories());
    playThrowSound();
    setStatusMessage(
      `${getPlayerName(activePlayer)} is throwing the sticks...`
    );

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
      setAnimatedSticks(throwResult.sticks);
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
          <div className="throw-overlay-stage">
            {animatedSticks.map((stickFace, index) => {
              const trajectory = throwTrajectories[index];

              return (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={`throw-stick-${index}`}
                  className={`throw-stick ${stickFace === 'flat' ? 'throw-stick-flat' : 'throw-stick-round'
                    } ${index === BACK_STICK_INDEX ? 'throw-stick-back' : ''}`}
                  style={{
                    '--throw-start-x': `${trajectory.startX}px`,
                    '--throw-peak-x': `${trajectory.peakX}px`,
                    '--throw-end-x': `${trajectory.endX}px`,
                    '--throw-tilt': `${trajectory.tilt}deg`,
                    '--throw-delay': `${trajectory.delay}ms`,
                    '--throw-duration': `${trajectory.duration}ms`,
                    '--throw-peak-y': trajectory.peakY,
                    '--throw-drop-y': trajectory.dropY,
                    '--throw-spin': `${trajectory.spins}deg`,
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
