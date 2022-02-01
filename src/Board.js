import './Board.css';
import { useState, useEffect } from 'react';

function Board(props) {
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

  useEffect(() => {
    console.log(`currentMark: ${currentMark}`);
  }, [currentMark]);

  const markClicked = (e) => {
    e.preventDefault();

    const dataPlayer = e.target.getAttribute('data-player');

    const markID = e.target.getAttribute('data-mark-id');
    // console.log(
    //   `propsPlayer: ${typeof props.player}, dataPlayer: ${typeof dataPlayer}, markID: ${markID}`
    // );

    if (
      (props.player === 1 && dataPlayer === '1') ||
      (props.player === 2 && dataPlayer === '2')
    ) {
      setCurrentMark(markID);
    }
  };

  const stationClicked = (e) => {
    e.preventDefault();
    // console.log('stationClicked');

    // TODO don't let mark go backwards, e.g. moves = 2, currentStation = 5
    // TODO: move multiple different marks, split moves into multiple moves
    // TODO: don't let click on non current player's mark register
    // TODO: don't let mark move around corner at diagonal
    // TODO: once same player's marks are on the same station, they move together henceforth

    let station = e.target;
    let stationNumber = parseInt(station.getAttribute('data-station-number'));
    let stationDiagonal = station.getAttribute('data-diagonal');
    // console.log(`props.moves: ${props.moves}`);
    // console.log(`current Mark's station Number: ${player1Marks[currentMark]}`);
    if (
      props.moves !== 0 &&
      (stationNumber <= props.moves ||
        stationNumber <= player1Marks[currentMark] + props.moves ||
        stationNumber <= player2Marks[currentMark] + props.moves)
    ) {
      let markToMove = document.querySelector(
        `[data-player="${props.player}"][data-mark-id="${currentMark}"]`
      );

      if (markToMove) {
        markToMove.remove();
      }

      let mark = document.createElement('div');
      mark.classList.add('Mark', `player${props.player}Mark`);
      mark.setAttribute('data-mark-id', currentMark);
      mark.setAttribute('data-player', props.player);
      mark.addEventListener('click', markClicked);
      e.target.appendChild(mark);

      let previousStationNumber =
        props.player === 1
          ? player1Marks[currentMark]
          : player2Marks[currentMark];
      // console.log(`previousStationNumber: ${previousStationNumber}`);
      let movesMade = Math.abs(stationNumber - previousStationNumber);

      function stationStuff(player) {
        let playerMarks = player === 1 ? player1Marks : player2Marks;
        let otherPlayerMarks = player === 1 ? player2Marks : player1Marks;
        // check if other player's mark is on the same station
        let otherPlayerOnStation = Object.keys(otherPlayerMarks).some(
          (k) => otherPlayerMarks[k] === stationNumber
        );
        if (otherPlayerOnStation) {
          // if so, remove other player's mark
          let otherPlayerMark =
            player === 1
              ? station.querySelector('.player2Mark')
              : station.querySelector('.player1Mark');
          // console.log(otherPlayerMark);

          otherPlayerMark.remove();
          otherPlayerMarks[currentMark] = null;
          props.handleStationClick(movesMade, true);
        } else {
          props.handleStationClick(movesMade);
        }
        let newObj = { ...playerMarks };
        newObj[currentMark] = stationNumber;
        player === 1
          ? setPlayer1Marks({ ...newObj })
          : setPlayer2Marks({ ...newObj });
      }

      props.player === 1 ? stationStuff(1) : stationStuff(2);
    }

    console.log(
      `stationNumber: ${stationNumber}, stationDiagonal: ${stationDiagonal}`
    );
  };

  return (
    <div className="Board">
      <div className="MarkContainer">
        <div
          onClick={markClicked}
          data-player="1"
          className="Mark player1Mark"
          data-mark-id="1"
        />
        <div
          onClick={markClicked}
          data-player="1"
          className="Mark player1Mark"
          data-mark-id="2"
        />
        <div
          onClick={markClicked}
          data-player="1"
          className="Mark player1Mark"
          data-mark-id="3"
        />
        <div
          onClick={markClicked}
          data-player="1"
          className="Mark player1Mark"
          data-mark-id="4"
        />

        <div
          onClick={markClicked}
          data-player="2"
          className="Mark player2Mark"
          data-mark-id="1"
        />
        <div
          onClick={markClicked}
          data-player="2"
          className="Mark player2Mark"
          data-mark-id="2"
        />
        <div
          onClick={markClicked}
          data-player="2"
          className="Mark player2Mark"
          data-mark-id="3"
        />
        <div
          onClick={markClicked}
          data-player="2"
          className="Mark player2Mark"
          data-mark-id="4"
        />
      </div>

      <div className="StationContainer">
        <div
          onClick={stationClicked}
          className="Station topleft"
          data-station-number="10"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="9"
        />
        <div
          onClick={stationClicked}
          className="Station leftgap"
          data-station-number="8"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station rightgap"
          data-station-number="7"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="6"
        />
        <div
          onClick={stationClicked}
          className="Station topright"
          data-station-number="5"
        />

        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="11"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="11"
          data-diagonal="left"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="6"
          data-diagonal="right"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="4"
        />

        <div
          onClick={stationClicked}
          className="Station abovegap"
          data-station-number="12"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="12"
          data-diagonal="left"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="7"
          data-diagonal="right"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station abovegap"
          data-station-number="3"
        />

        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station centerpiece"
          data-station-number="[8,13]"
          data-diagonal="center"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />

        <div
          onClick={stationClicked}
          className="Station belowgap"
          data-station-number="13"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="9"
          data-diagonal="left"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="[9, 14]"
          data-diagonal="right"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station belowgap"
          data-station-number="2"
        />

        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="14"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="10"
          data-diagonal="left"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="[10, 15]"
          data-diagonal="right"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="1"
        />

        <div
          onClick={stationClicked}
          className="Station bottomleft"
          data-station-number="15"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="16"
        />
        <div
          onClick={stationClicked}
          className="Station leftgap"
          data-station-number="17"
        />
        <div onClick={stationClicked} className="Station hidden" />
        <div
          onClick={stationClicked}
          className="Station rightgap"
          data-station-number="18"
        />
        <div
          onClick={stationClicked}
          className="Station"
          data-station-number="19"
        />
        <div
          onClick={stationClicked}
          className="Station bottomright"
          data-station-number="[11, 16, 20]"
        />
      </div>
    </div>
  );
}

export default Board;
