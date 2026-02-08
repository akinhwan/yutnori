import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import Board from './Board';
import {
  THROW_NAMES,
  HOME,
  applyMove,
  createInitialTokens,
  getDestinationOptions,
  hasPlayerWon,
  rollThrow,
} from './gameLogic';

const PLAYER_LABELS = {
  1: 'Red',
  2: 'Blue',
};

const describeThrow = (value) => `${THROW_NAMES[value]} (${value})`;
const splitStatusMessage = (message) =>
  message.split(/(?<=[.!?])\s+/).filter(Boolean);
const DEFAULT_STICKS = ['round', 'round', 'round', 'round'];
const THROW_ANIMATION_DURATION_MS = 900;
const THROW_ANIMATION_TICK_MS = 90;
const createRandomStickFaces = () =>
  Array.from({ length: 4 }, () => (Math.random() < 0.5 ? 'flat' : 'round'));

function App() {
  const [tokens, setTokens] = useState(() => createInitialTokens());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [moveQueue, setMoveQueue] = useState([]);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [lastThrow, setLastThrow] = useState(null);
  const [isThrowAnimating, setIsThrowAnimating] = useState(false);
  const [animatedSticks, setAnimatedSticks] = useState(DEFAULT_STICKS);
  const [throwAllowance, setThrowAllowance] = useState(1);
  const [winner, setWinner] = useState(null);
  const [statusMessage, setStatusMessage] = useState(
    'Player 1 (Red) starts. Throw the sticks.'
  );
  const audioContextRef = useRef(null);
  const throwAnimationIntervalRef = useRef(null);
  const throwRevealTimeoutRef = useRef(null);
  const selectedMoveSoundKeyRef = useRef(null);

  const resolvedMoveIndex =
    selectedMoveIndex !== null && selectedMoveIndex < moveQueue.length
      ? selectedMoveIndex
      : moveQueue.length > 0
      ? 0
      : null;

  const pendingMove =
    resolvedMoveIndex === null ? null : moveQueue[resolvedMoveIndex];

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

  const destinationOptions = useMemo(() => {
    if (winner !== null || pendingMove === null || selectedTokenId === null) {
      return [];
    }
    const selectedPosition = tokens[currentPlayer][selectedTokenId];
    if (!selectedPosition || selectedPosition === HOME) {
      return [];
    }
    return getDestinationOptions(selectedPosition, pendingMove);
  }, [winner, pendingMove, selectedTokenId, tokens, currentPlayer]);

  const clearThrowAnimationTimers = useCallback(() => {
    if (throwAnimationIntervalRef.current !== null) {
      window.clearInterval(throwAnimationIntervalRef.current);
      throwAnimationIntervalRef.current = null;
    }

    if (throwRevealTimeoutRef.current !== null) {
      window.clearTimeout(throwRevealTimeoutRef.current);
      throwRevealTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearThrowAnimationTimers();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [clearThrowAnimationTimers]);

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
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }, []);

  const playCaptureSound = useCallback(
    (capturedCount) => {
      if (capturedCount <= 0) {
        return;
      }

      const audioContext = getAudioContext();
      if (!audioContext) {
        return;
      }

      const now = audioContext.currentTime;
      const pulseCount = Math.min(capturedCount, 4);

      for (let index = 0; index < pulseCount; index += 1) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const startAt = now + index * 0.08;
        const stopAt = startAt + 0.18;
        const frequency = 420 + index * 90;

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.35,
          stopAt
        );

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.2, startAt + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(startAt);
        oscillator.stop(stopAt);
      }
    },
    [getAudioContext]
  );

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

  useEffect(() => {
    if (
      pendingMove === null ||
      resolvedMoveIndex === null ||
      moveQueue.length === 0
    ) {
      selectedMoveSoundKeyRef.current = null;
      return;
    }

    const selectionKey = `${currentPlayer}:${resolvedMoveIndex}:${moveQueue.join(
      ','
    )}`;
    if (selectedMoveSoundKeyRef.current === selectionKey) {
      return;
    }

    selectedMoveSoundKeyRef.current = selectionKey;
    playMoveSelectedSound();
  }, [
    currentPlayer,
    moveQueue,
    pendingMove,
    playMoveSelectedSound,
    resolvedMoveIndex,
  ]);

  useEffect(() => {
    if (winner !== null || isThrowAnimating || pendingMove === null) {
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
    getMovableTokenIds,
    isThrowAnimating,
    pendingMove,
    selectedTokenId,
    winner,
  ]);

  const throwYut = () => {
    if (throwAllowance <= 0 || winner !== null || isThrowAnimating) {
      return;
    }

    getAudioContext();

    const throwResult = rollThrow();
    const activePlayer = currentPlayer;

    clearThrowAnimationTimers();
    setIsThrowAnimating(true);
    setAnimatedSticks(createRandomStickFaces());
    setStatusMessage(
      `Player ${activePlayer} (${PLAYER_LABELS[activePlayer]}) is throwing the sticks...`
    );

    throwAnimationIntervalRef.current = window.setInterval(() => {
      setAnimatedSticks(createRandomStickFaces());
    }, THROW_ANIMATION_TICK_MS);

    throwRevealTimeoutRef.current = window.setTimeout(() => {
      clearThrowAnimationTimers();
      setLastThrow(throwResult);
      setAnimatedSticks(throwResult.sticks);
      setMoveQueue((previousQueue) => [...previousQueue, throwResult.value]);
      setSelectedMoveIndex((previousIndex) =>
        previousIndex === null ? 0 : previousIndex
      );
      setThrowAllowance((previousAllowance) =>
        Math.max(0, previousAllowance - 1) + (throwResult.extraTurn ? 1 : 0)
      );
      setIsThrowAnimating(false);
      const movableTokenIds = getMovableTokenIds(activePlayer, throwResult.value);
      setStatusMessage(
        throwResult.extraTurn
          ? `Player ${activePlayer} (${PLAYER_LABELS[activePlayer]}) threw ${describeThrow(
              throwResult.value
            )}. Bonus throw earned.`
          : movableTokenIds.length === 1
          ? `Player ${activePlayer} (${PLAYER_LABELS[activePlayer]}) threw ${describeThrow(
              throwResult.value
            )}.`
          : `Player ${activePlayer} (${PLAYER_LABELS[activePlayer]}) threw ${describeThrow(
              throwResult.value
            )}. Select a mal to move.`
      );
    }, THROW_ANIMATION_DURATION_MS);
  };

  const applySelectedMove = ({ option, tokenId, moveIndex, availableOptions }) => {
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
    const nextThrowAllowance =
      throwAllowance + (capturedCount > 0 ? 1 : 0);
    const canThrowAgain = nextThrowAllowance > 0;

    if (capturedCount > 0) {
      playCaptureSound(capturedCount);
    }

    setTokens(moveResult.tokens);
    setMoveQueue(remainingQueue);
    setSelectedMoveIndex(remainingQueue.length > 0 ? 0 : null);
    setSelectedTokenId(null);

    if (hasPlayerWon(moveResult.tokens, currentPlayer)) {
      setWinner(currentPlayer);
      setThrowAllowance(0);
      setStatusMessage(
        `Player ${currentPlayer} (${PLAYER_LABELS[currentPlayer]}) wins by bringing all mals home.`
      );
      return;
    }

    const movedCount = moveResult.movedTokenIds.length;
    const movedText =
      option.position === HOME ? 'reached home' : 'moved on the board';
    const captureText =
      capturedCount > 0
        ? ` Captured ${capturedCount} opponent mal${
            capturedCount > 1 ? 's' : ''
          }.`
        : '';

    if (remainingQueue.length === 0 && !canThrowAgain) {
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(nextPlayer);
      setThrowAllowance(1);
      setStatusMessage(
        `Player ${currentPlayer} (${PLAYER_LABELS[currentPlayer]}) ${movedText} with ${movedCount} mal${
          movedCount > 1 ? 's' : ''
        }.${captureText} Turn passes to Player ${nextPlayer} (${PLAYER_LABELS[nextPlayer]}).`
      );
      return;
    }

    setThrowAllowance(nextThrowAllowance);
    setStatusMessage(
      `Player ${currentPlayer} (${PLAYER_LABELS[currentPlayer]}) ${movedText} with ${movedCount} mal${
        movedCount > 1 ? 's' : ''
      }.${captureText}${
        canThrowAgain
          ? ' You may throw again or use another queued move.'
          : ' Use another queued move.'
      }`
    );
  };

  const handleSelectToken = (tokenId) => {
    if (winner !== null || isThrowAnimating || pendingMove === null) {
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
  };

  const handleSelectDestination = (option) => {
    if (selectedTokenId === null || resolvedMoveIndex === null) {
      return;
    }

    applySelectedMove({
      option,
      tokenId: selectedTokenId,
      moveIndex: resolvedMoveIndex,
      availableOptions: destinationOptions,
    });
  };

  const sticks = isThrowAnimating
    ? animatedSticks
    : lastThrow?.sticks ?? DEFAULT_STICKS;
  const shouldHighlightStartTokens =
    winner === null &&
    !isThrowAnimating &&
    pendingMove !== null &&
    selectedTokenId === null;

  return (
    <div className="App">
      <div
        className={`control-panel control-panel-player-${
          winner ?? currentPlayer
        }`}
      >
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

        <div className="control-row">
          <button
            type="button"
            className={`throw-button ${
              throwAllowance > 0 && winner === null && !isThrowAnimating
                ? 'throw-button-next'
                : ''
            }`}
            onClick={throwYut}
            disabled={throwAllowance <= 0 || winner !== null || isThrowAnimating}
          >
            Throw Yut Sticks
          </button>
          {/* <button type="button" className="reset-button" onClick={resetGame}>
            Reset Game
          </button> */}
        </div>

        {/* <p className="pending-move">
          {pendingMove === null
            ? 'No pending move selected.'
            : `Selected move: ${describeThrow(pendingMove)}`}
        </p> */}

        {/* <div className="move-queue">
          {moveQueue.length === 0 ? (
            <span className="queue-empty">No queued throws</span>
          ) : (
            moveQueue.map((move, index) => (
              <button
                type="button"
                key={`${move}-${index}`}
                className={`move-chip ${
                  index === resolvedMoveIndex ? 'move-chip-selected' : ''
                }`}
                onClick={() => handleSelectMove(index)}
                disabled={winner !== null || isThrowAnimating}
              >
                {describeThrow(move)}
              </button>
            ))
          )}
        </div> */}

        <div
          className={`stick-container ${
            isThrowAnimating ? 'stick-container-throwing' : ''
          }`}
        >
          {sticks.map((stickFace, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`stick-${index}`}
              className={`stick ${
                stickFace === 'flat' ? 'stick-flat' : 'stick-round'
              } ${isThrowAnimating ? 'stick-throwing' : ''}`}
            />
          ))}
        </div>

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
      </div>

      <Board
        tokens={tokens}
        currentPlayer={currentPlayer}
        selectedTokenId={selectedTokenId}
        pendingMove={pendingMove}
        shouldHighlightStartTokens={shouldHighlightStartTokens}
        destinationOptions={destinationOptions}
        onTokenSelect={handleSelectToken}
        onDestinationSelect={handleSelectDestination}
      />
    </div>
  );
}

export default App;
