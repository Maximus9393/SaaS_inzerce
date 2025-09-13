import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

function Header() {
  const [dark, setDark] = React.useState<boolean>(false);
  const headerRef = React.useRef<HTMLElement | null>(null);
  const theme = useTheme();

  React.useEffect(() => {
    // initialize theme from localStorage or OS preference
    try {
      const stored = localStorage.getItem('theme-dark');
      let initial = false;
      if (stored !== null) initial = stored === '1' || stored === 'true';
      else initial = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDark(Boolean(initial));
      theme.setThemeDark(Boolean(initial));
    } catch (e) {
      // ignore in non-browser env
    }
  }, []);

  React.useEffect(() => {
    // Toggle `.scrolled` on the header when user scrolls past a small threshold.
    let ticking = false;
    const onScroll = () => {
      if (!headerRef.current) return;
      const isScrolled = window.scrollY > 12;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isScrolled) headerRef.current!.classList.add('scrolled');
          else headerRef.current!.classList.remove('scrolled');
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // trigger initial check
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  return (
    <header ref={headerRef} className="site-header" role="banner">
      <div className="site-header-inner container">
        <div className="brand">
          <Link to="/" aria-label="Domů" className="logo">🚗</Link>
          <div>
            <div className="brand-title">Smart Market Finder</div>
            <div className="brand-sub">Vyhledávač aut z bazarů</div>
          </div>
        </div>

        {/* mobile toggle */}
        <button
          className={`nav-toggle ${menuOpen ? 'open' : ''}`}
          aria-label={menuOpen ? 'Zavřít navigaci' : 'Otevřít navigaci'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="hamburger"><span></span><span></span><span></span></span>
        </button>

        {/* theme toggle */}
        <button
          className="theme-toggle"
          aria-label={dark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
          onClick={() => {
            try {
              const next = !dark;
              setDark(next);
              theme.setThemeDark(next);
              try { localStorage.setItem('theme-dark', next ? '1' : '0'); } catch (e) {}
            } catch (e) {}
          }}
        >
          <span className="icon" aria-hidden>{dark ? '🌙' : '☀️'}</span>
        </button>

        <nav className={`site-nav ${menuOpen ? 'open' : ''}`} aria-label="Hlavní navigace">
          <Link to="/" aria-current="page" onClick={() => setMenuOpen(false)}><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5z" fill="currentColor"/></svg><span>Domů</span><span className="nav-underline" /></Link>
          <Link to="/about" onClick={() => setMenuOpen(false)}><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg><span>O projektu</span><span className="nav-underline" /></Link>
          <Link to="/contact" onClick={() => setMenuOpen(false)}><svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" fill="currentColor"/></svg><span>Kontakt</span><span className="nav-underline" /></Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
