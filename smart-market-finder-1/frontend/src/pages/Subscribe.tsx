import React, { useState } from 'react';

const Subscribe: React.FC = () => {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const submit = (e: any) => { e.preventDefault(); setOk(true); };
  return (
    <div>
      <h2>Chci dostávat novinky</h2>
      {ok ? <p>Děkujeme! Brzy vás budeme informovat.</p> : (
        <form onSubmit={submit}>
          <input type="email" placeholder="Váš e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="button" type="submit">Přihlásit se</button>
        </form>
      )}
    </div>
  );
};

export default Subscribe;
