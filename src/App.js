import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Rider from "./Rider";
import SignInSignUp from "./Sign";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/Sign" element={<SignInSignUp />} />
          <Route path="/" element={<Rider />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
