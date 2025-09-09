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
          <Link to="/" aria-current="page"><span className="nav-icon">🏠</span> Domů <span className="nav-underline" /></Link>
          <Link to="/about"><span className="nav-icon">ℹ️</span> O projektu <span className="nav-underline" /></Link>
          <Link to="/contact"><span className="nav-icon">✉️</span> Kontakt <span className="nav-underline" /></Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
