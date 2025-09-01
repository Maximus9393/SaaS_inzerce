import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import AddAd from './pages/AddAd';
import Subscribe from './pages/Subscribe';
import './styles/tokens.css';
import './styles/main.css';
import BackendStatus from './components/BackendStatus';
import Header from './components/Header';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Header />
        <main style={{ paddingTop: 84 }}>
          <div className="container">
            <BackendStatus />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/add" element={<AddAd />} />
              <Route path="/subscribe" element={<Subscribe />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;