import React from 'react';

const DashboardHero: React.FC = () => {
  return (
    <section style={{ background: 'linear-gradient(180deg, var(--glass), transparent)', borderRadius: '12px', padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ flex: 1 }}>
        <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)' }}>Find high-potential market opportunities</h2>
        <p style={{ marginTop: 8, color: 'var(--muted)' }}>Smart Market Finder analyzuje inzeráty a tržní data, aby vám navrhl příležitosti s největším potenciálem.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="button primary">Run analysis</button>
          <button className="button">Learn more</button>
        </div>
      </div>
      <div style={{ width: 220, height: 120, borderRadius: 10, background: 'linear-gradient(135deg,#eef7ff,#f8fbff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ color: 'var(--primary-600)', fontWeight: 700 }}>📈 Trend snapshot</div>
      </div>
    </section>
  );
}

export default DashboardHero;
