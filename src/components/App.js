import "./App.css";
import Board from "./Board";
import { useState, useEffect, useCallback, useRef } from "react";

function App() {
  const [sticks, setSticks] = useState(["", "", "", ""]);
  const [nameOfThrow, setNameOfThrow] = useState("");
  const [player, setPlayer] = useState(1);
  const [moves, setMoves] = useState(0);
  const [turn, setTurn] = useState(true);

  const handleStationClick = (movesMade, goAgain) => {
    console.log(movesMade, moves, goAgain);
    if (movesMade > moves) return;
    let remainingMoves = moves - movesMade;

    setMoves(remainingMoves);

    if (remainingMoves === 0 && !goAgain) {
      if (player === 1) {
        setPlayer(2);
        setTurn(true);
      } else if (player === 2) {
        setPlayer(1);
        setTurn(true);
      }
    }
    if (goAgain) {
      setTurn(true);
    }
  };

  const throwYut = () => {
    setSticks([flip(), flip(), flip(), flip()]);
    setTurn(false);
  };

  const calcThrow = useCallback(() => {
    let upCount = 0;
    let downCount = 0;
    for (const s of sticks) {
      if (s === "up") {
        upCount++;
      } else if (s === "down") {
        downCount++;
      }
    }
    if (upCount === 1 && downCount === 3) {
      setNameOfThrow(`"do" (도, pig)`);
      setMoves((currentMoves) => currentMoves + 1);
    } else if (upCount === 2 && downCount === 2) {
      setNameOfThrow('"gae" (개, dog)');
      setMoves((currentMoves) => currentMoves + 2);
    } else if (upCount === 3 && downCount === 1) {
      setNameOfThrow('"geol" (걸, sheep)');
      setMoves((currentMoves) => currentMoves + 3);
    } else if (upCount === 4 && downCount === 0) {
      setNameOfThrow('"yut" (윷, cow)');
      setMoves((currentMoves) => currentMoves + 4);
    } else {
      setNameOfThrow('"mo" (모, horse)');
      setMoves((currentMoves) => currentMoves + 5);
    }
  }, [sticks]);

  useEffect(() => {
    // if none of elements in sticks array is empty string then calculate the throw
    if (sticks.every((stick) => stick !== "")) {
      calcThrow();
    }
  }, [sticks, calcThrow]);

  const flip = () => {
    let x = Math.floor(Math.random() * 2) === 0;
    if (x) {
      return "up";
    } else {
      return "down";
    }
  };

  return (
    <div className="App">
      <p className="player-indicator">{player === 1 ? "1 red" : "2 blue"}</p>
      <p className="moves-indicator">{moves}</p>
      <button
        disabled={!turn}
        className="throw-yut-button"
        onClick={() => throwYut()}
      >
        Throw Yut
      </button>
      <h1 className="name-of-throw">{nameOfThrow}</h1>
      <div className="stick-container">
        {sticks.map((stick, index) => (
          <div
            key={index}
            className={`stick ${stick === "up" ? "flip" : "no"}`}
          ></div>
        ))}
      </div>
      <Board
        player={player}
        moves={moves}
        handleStationClick={handleStationClick}
      />
    </div>
  );
}

export default App;
