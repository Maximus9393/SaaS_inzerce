import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  const [dark, setDark] = React.useState<boolean>(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', dark);
  }, [dark]);

  return (
    <header className="site-header minimal">
      <div className="site-header-inner">
        <div className="brand">
          <Link to="/" aria-label="Domů" className="logo">🚗</Link>
        </div>
        <nav className="site-nav" aria-label="Hlavní navigace">
          <Link to="/">Domů</Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
