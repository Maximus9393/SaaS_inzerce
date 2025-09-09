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
          <Link to="/" aria-current="page"><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5z" fill="currentColor"/></svg><span>Domů</span><span className="nav-underline" /></Link>
          <Link to="/about"><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg><span>O projektu</span><span className="nav-underline" /></Link>
          <Link to="/contact"><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" fill="currentColor"/></svg><span>Kontakt</span><span className="nav-underline" /></Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
