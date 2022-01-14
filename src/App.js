import './App.css';
import Board from './Board';
import { useState, useEffect } from 'react';

function App() {
  const [stick1, setStick1] = useState('');
  const [stick2, setStick2] = useState('');
  const [stick3, setStick3] = useState('');
  const [stick4, setStick4] = useState('');
  const [nameOfThrow, setNameOfThrow] = useState('');
  const [player, setPlayer] = useState(1);
  const [moves, setMoves] = useState(0);
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

  const handleMarkClick = (markID) => {
    console.log(markID);
  };

  const throwYut = () => {
    setStick1(flip());
    setStick2(flip());
    setStick3(flip());
    setStick4(flip());
  };

  useEffect(() => {
    calcThrow();
  }, []);

  const calcThrow = () => {
    let sticks = [stick1, stick2, stick3, stick4];
    let upCount = 0;
    let downCount = 0;
    for (const s of sticks) {
      if (s === 'up') {
        upCount++;
      } else if (s === 'down') {
        downCount++;
      }
    }

    if (upCount === 1 && downCount === 3) {
      setNameOfThrow(`"do" (도, pig)`);
      setMoves(moves + 1);
    } else if (upCount === 2 && downCount === 2) {
      setNameOfThrow('"gae" (개, dog)');
      setMoves(moves + 2);
    } else if (upCount === 3 && downCount === 1) {
      setNameOfThrow('"geol" (걸, sheep)');
      setMoves(moves + 3);
    } else if (upCount === 4 && downCount === 0) {
      setNameOfThrow('"yut" (윷, cow)');
      setMoves(moves + 4);
    } else {
      setNameOfThrow('"mo" (모, horse)');
      setMoves(moves + 5);
    }
  };

  const flip = () => {
    let x = Math.floor(Math.random() * 2) === 0;
    if (x) {
      return 'up';
    } else {
      return 'down';
    }
  };

  return (
    <div className="App">
      <button className="throw-yut-button" onClick={() => throwYut()}>
        Throw Yut
      </button>
      <h1 className="name-of-throw">{nameOfThrow}</h1>
      <div className="stick-container">
        <div className={`stick ${stick1 === 'up' ? 'flip' : 'no'}`}> </div>
        <div className={`stick ${stick2 === 'up' ? 'flip' : 'no'}`}> </div>
        <div className={`stick ${stick3 === 'up' ? 'flip' : 'no'}`}> </div>
        <div className={`stick ${stick4 === 'up' ? 'flip' : 'no'}`}> </div>
      </div>
      <Board player={player} handleMarkClick={handleMarkClick} />
    </div>
  );
}

export default App;
