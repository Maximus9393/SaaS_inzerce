import React from 'react';

const Header: React.FC = () => {
  const [dark, setDark] = React.useState<boolean>(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', dark);
  }, [dark]);

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 72, background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', zIndex: 900 }}>
      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>SM</div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Smart Market Finder</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Discover market opportunities</div>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Dashboard</a>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Analytics</a>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Pricing</a>
          <button style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, transition: 'transform var(--trans-fast)' }} onMouseEnter={(e)=> (e.currentTarget.style.transform='translateY(-2px)')} onMouseLeave={(e)=> (e.currentTarget.style.transform='translateY(0)')}>Try free</button>
          <button aria-label="Toggle dark" title="Dark mode" onClick={() => setDark(d => !d)} style={{ background: 'transparent', border: '1px solid var(--glass)', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}>
            {dark ? '🌙' : '☀️'}
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
