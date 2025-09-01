import React from 'react';

const DashboardHero: React.FC = () => {
  return (
    <section className="dashboard-hero">
      <div className="hero-content">
        <h2>Najděte auto z bazaru nejvýhodněji</h2>
        <p>Prohledáváme všechny české bazary – pouze auta.</p>
        <div className="hero-categories">
          <div className="cat">🚗 Auta</div>
        </div>
        <div className="hero-actions">
          <button className="button primary" disabled={true}>Vyhledávání aut je aktivní</button>
        </div>
      </div>
    </section>
  );
}

export default DashboardHero;
