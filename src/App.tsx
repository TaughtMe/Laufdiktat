
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Dashboard } from './pages/Dashboard';
import { LegalPage } from './pages/LegalPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/legal" element={<LegalPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
