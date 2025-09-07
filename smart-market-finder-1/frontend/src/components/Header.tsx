import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  const [dark, setDark] = React.useState<boolean>(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', dark);
  }, [dark]);

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner container">
        <div className="brand">
          <Link to="/" aria-label="Domů" className="logo">🚗</Link>
          <div>
            <div className="brand-title">Smart Market Finder</div>
            <div className="brand-sub">Vyhledávač aut z bazarů</div>
          </div>
        </div>
        <nav className="site-nav" aria-label="Hlavní navigace">
          <Link to="/">Domů</Link>
          <Link to="/about">O projektu</Link>
          <Link to="/contact">Kontakt</Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
