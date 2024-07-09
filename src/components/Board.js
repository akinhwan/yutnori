import "./Board.css";
import { useState, useEffect, useRef } from "react";

function Board({ player, moves, handleStationClick }) {
  const [currentMark, setCurrentMark] = useState(null);
  const [player1Marks, setPlayer1Marks] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  const [player2Marks, setPlayer2Marks] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const markRefs = useRef({});
  const stationRefs = useRef({});

  useEffect(() => {
    console.log(`currentMark: ${currentMark}`);
  }, [currentMark]);

  const markClicked = (e) => {
    e.preventDefault();
    const dataPlayer = e.target.getAttribute("data-player");
    const markID = e.target.getAttribute("data-mark-id");

    if (
      (player === 1 && dataPlayer === "1") ||
      (player === 2 && dataPlayer === "2")
    ) {
      setCurrentMark(markID);
    }
  };

  const stationClicked = (e) => {
    e.preventDefault();

    const station = e.target;
    const stationNumber = parseInt(station.getAttribute("data-station-number"));
    const stationDiagonal = station.getAttribute("data-diagonal");

    if (
      moves !== 0 &&
      (stationNumber <= moves ||
        stationNumber <= player1Marks[currentMark] + moves ||
        stationNumber <= player2Marks[currentMark] + moves)
    ) {
      const markToMove = markRefs.current[currentMark];

      if (markToMove) {
        const previousParent = markToMove.parentNode;
        if (previousParent) {
          previousParent.removeChild(markToMove);
        }

        station.appendChild(markToMove);

        const previousStationNumber =
          player === 1 ? player1Marks[currentMark] : player2Marks[currentMark];
        const movesMade = Math.abs(stationNumber - previousStationNumber);

        function stationStuff(player) {
          const playerMarks = player === 1 ? player1Marks : player2Marks;
          const otherPlayerMarks = player === 1 ? player2Marks : player1Marks;
          const otherPlayerOnStation = Object.keys(otherPlayerMarks).some(
            (k) => otherPlayerMarks[k] === stationNumber
          );
          if (otherPlayerOnStation) {
            const otherPlayerMark =
              player === 1
                ? station.querySelector(".player2Mark")
                : station.querySelector(".player1Mark");

            if (otherPlayerMark) {
              otherPlayerMark.remove();
            }
            otherPlayerMarks[currentMark] = null;
            handleStationClick(movesMade, true);
          } else {
            handleStationClick(movesMade);
          }
          const newObj = { ...playerMarks };
          newObj[currentMark] = stationNumber;
          player === 1
            ? setPlayer1Marks({ ...newObj })
            : setPlayer2Marks({ ...newObj });
        }

        player === 1 ? stationStuff(1) : stationStuff(2);
      }
    }

    console.log(
      `stationNumber: ${stationNumber}, stationDiagonal: ${stationDiagonal}`
    );
  };

  return (
    <div className="Board">
      <div className="MarkContainer">
        {[1, 2, 3, 4].map((id) => (
          <div
            key={`p1-mark-${id}`}
            onClick={markClicked}
            data-player="1"
            className="Mark player1Mark"
            data-mark-id={id}
            ref={(el) => (markRefs.current[id] = el)}
          />
        ))}
        {[1, 2, 3, 4].map((id) => (
          <div
            key={`p2-mark-${id}`}
            onClick={markClicked}
            data-player="2"
            className="Mark player2Mark"
            data-mark-id={id}
            ref={(el) => (markRefs.current[id] = el)}
          />
        ))}
      </div>

      <div className="StationContainer">
        {[
          { number: 10, className: "topleft" },
          { number: 9, className: "" },
          { number: 8, className: "leftgap" },
          { number: null, className: "hidden" },
          { number: 7, className: "rightgap" },
          { number: 6, className: "" },
          { number: 5, className: "topright" },
          { number: 11, className: "" },
          { number: 11, className: "", diagonal: "left" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: 6, className: "", diagonal: "right" },
          { number: 4, className: "" },
          { number: 12, className: "abovegap" },
          { number: null, className: "hidden" },
          { number: 12, className: "", diagonal: "left" },
          { number: null, className: "hidden" },
          { number: 7, className: "", diagonal: "right" },
          { number: null, className: "hidden" },
          { number: 3, className: "abovegap" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: [8, 13], className: "centerpiece", diagonal: "center" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: 13, className: "belowgap" },
          { number: null, className: "hidden" },
          { number: 9, className: "", diagonal: "left" },
          { number: null, className: "hidden" },
          { number: [9, 14], className: "", diagonal: "right" },
          { number: null, className: "hidden" },
          { number: 2, className: "belowgap" },
          { number: 14, className: "" },
          { number: 10, className: "", diagonal: "left" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: null, className: "hidden" },
          { number: [10, 15], className: "", diagonal: "right" },
          { number: 1, className: "" },
          { number: 15, className: "bottomleft" },
          { number: 16, className: "" },
          { number: 17, className: "leftgap" },
          { number: null, className: "hidden" },
          { number: 18, className: "rightgap" },
          { number: 19, className: "" },
          { number: [11, 16, 20], className: "bottomright" },
        ].map((station, index) => (
          <div
            key={index}
            onClick={stationClicked}
            className={`Station ${station.className}`}
            data-station-number={station.number}
            data-diagonal={station.diagonal}
            ref={(el) => (stationRefs.current[station.number] = el)}
          />
        ))}
      </div>
    </div>
  );
}

export default Board;
