import './App.css';
import Board from './Board';
import { useState, useEffect } from 'react';

function App() {
  const [stick1, setStick1] = useState('');
  const [stick2, setStick2] = useState('');
  const [stick3, setStick3] = useState('');
  const [stick4, setStick4] = useState('');
  const [nameOfThrow, setNameOfThrow] = useState('');

  const throwYut = () => {
    setStick1(flip());
    setStick2(flip());
    setStick3(flip());
    setStick4(flip());
  };

  useEffect(() => {
    calcNameOfThrow();
  });

  const calcNameOfThrow = () => {
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
      setNameOfThrow('do');
    } else if (upCount === 2 && downCount === 2) {
      setNameOfThrow('ge');
    } else if (upCount === 3 && downCount === 1) {
      setNameOfThrow('geol');
    } else if (upCount === 4 && downCount === 0) {
      setNameOfThrow('yut');
    } else {
      setNameOfThrow('mo');
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
      <Board />
    </div>
  );
}

export default App;
