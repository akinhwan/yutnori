import './App.css';
import Board from './Board';

function App() {
  const throwYut = () => {
    console.log('Hello World!');
  };
  return (
    <div className="App">
      <button className="throw-yut-button" onClick={() => throwYut()}>
        Throw Yut
      </button>
      <Board />
    </div>
  );
}

export default App;
