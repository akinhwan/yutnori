import './Board.css';
import { useState, useEffect } from 'react';

function Board(props) {
  const [currentMark, setCurrentMark] = useState(null);

  const markClicked = (e) => {
    console.log('markClicked');
    const markID = e.target.id;
    setCurrentMark(markID);

    props.handleMarkClick(markID);
  };

  const stationClicked = (e) => {
    console.log('stationClicked');
    // console.log(e.target);
    // if (e.target.hasChildNodes()) {
    //   console.log(e.target.children);
    // }
    let stationNumber = e.target.getAttribute('data-station-number');
    let stationDiagonal = e.target.getAttribute('data-diagonal');

    let markToMove = document.getElementById(currentMark);
    if (markToMove) {
      markToMove.remove();
    }

    let mark = document.createElement('div');
    mark.classList.add('Mark', `player${currentMark[0]}Mark`);
    mark.id = `${currentMark}`;
    mark.addEventListener('click', markClicked);

    e.target.appendChild(mark);

    console.log(stationNumber, stationDiagonal);
  };

  return (
    <div className="Board">
      <div className="MarkContainer">
        <div onClick={markClicked} className="Mark player1Mark" id="1b" />
        <div onClick={markClicked} className="Mark player1Mark" id="1a" />
        <div onClick={markClicked} className="Mark player1Mark" id="1c" />

        <div onClick={markClicked} className="Mark player2Mark" id="2a" />
        <div onClick={markClicked} className="Mark player2Mark" id="2b" />
        <div onClick={markClicked} className="Mark player2Mark" id="2c" />
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
