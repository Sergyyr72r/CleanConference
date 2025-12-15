import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateConference from './pages/CreateConference';
import Conference from './pages/Conference';
import GuestJoin from './pages/GuestJoin';

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create-conference" element={<CreateConference />} />
        <Route path="/conference/:roomId" element={<Conference />} />
        <Route path="/guest-join/:roomId" element={<GuestJoin />} />
      </Routes>
    </Router>
  );
}

export default App;

