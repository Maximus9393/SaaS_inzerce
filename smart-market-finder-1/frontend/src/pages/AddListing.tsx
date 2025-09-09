import React, { useState } from 'react';

type FormState = {
  brandModel: string;
  year: string;
  bodyType: string;
  fuelType: string;
  gearbox: string;
  power: string;
  engineSize: string;
  consumption: string;
  mileage: string;
  serviceHistory: string;
  accidents: string;
  tires: string;
  features: string;
  safety: string;
  price: string;
  negotiable: string;
  sellerName: string;
  contact: string;
  reason: string;
  inspection: string;
  description: string;
  images: File[];
};

const initial: FormState = {
  brandModel: '', year: '', bodyType: '', fuelType: '', gearbox: '', power: '', engineSize: '', consumption: '', mileage: '', serviceHistory: '', accidents: '', tires: '', features: '', safety: '', price: '', negotiable: '', sellerName: '', contact: '', reason: '', inspection: '', description: '', images: []
};

export default function AddListing() {
  const [form, setForm] = useState<FormState>(initial);
  const [previews, setPreviews] = useState<string[]>([]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files).slice(0, 20);
    setForm(f => ({ ...f, images: arr }));
    const urls = arr.map(f => URL.createObjectURL(f));
    setPreviews(urls);
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    // Simple front-end validation: required fields
    if (!form.brandModel || !form.year || !form.price || !form.sellerName || !form.contact) {
      alert('Vyplňte prosím povinná pole: značka a model, rok, cena, jméno a kontakt.');
      return;
    }
    // Here you would POST the form to backend API
    console.log('submit', form);
    alert('Inzerát uložen (simulace).');
    setForm(initial);
    setPreviews([]);
  }

  return (
    <main className="container">
      <h2>Přidat inzerát</h2>
      <form onSubmit={onSubmit} className="search-form">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Značka a model *</label>
          <input value={form.brandModel} onChange={e => update('brandModel', e.target.value)} />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Rok výroby *</label>
              <input value={form.year} onChange={e => update('year', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Typ karoserie</label>
              <input value={form.bodyType} onChange={e => update('bodyType', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Typ paliva</label>
              <select value={form.fuelType} onChange={e => update('fuelType', e.target.value)}>
                <option value="">Vyberte</option>
                <option>benzín</option>
                <option>nafta</option>
                <option>elektrické</option>
                <option>hybridní</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Převodovka</label>
              <select value={form.gearbox} onChange={e => update('gearbox', e.target.value)}>
                <option value="">Vyberte</option>
                <option>manuální</option>
                <option>automatická</option>
              </select>
            </div>
          </div>

          <label>Technické specifikace (volitelné)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Výkon motoru (kW/HP)" value={form.power} onChange={e => update('power', e.target.value)} />
            <input placeholder="Objem motoru" value={form.engineSize} onChange={e => update('engineSize', e.target.value)} />
            <input placeholder="Spotřeba" value={form.consumption} onChange={e => update('consumption', e.target.value)} />
          </div>

          <label>Stav vozidla (může být součástí textu)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Najeté kilometry" value={form.mileage} onChange={e => update('mileage', e.target.value)} />
            <input placeholder="Stav pneumatik" value={form.tires} onChange={e => update('tires', e.target.value)} />
          </div>

          <label>Výbava a bezpečnost (volitelné)</label>
          <input placeholder="Klimatizace, navigace, atd." value={form.features} onChange={e => update('features', e.target.value)} />

          <label>Fotografie</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 8 }}>
            {previews.map((p, i) => <img key={i} src={p} alt={`preview-${i}`} style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 6 }} />)}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Požadovaná cena *</label>
              <input value={form.price} onChange={e => update('price', e.target.value)} />
            </div>
            <div style={{ width: 160 }}>
              <label>Možnost vyjednávání</label>
              <select value={form.negotiable} onChange={e => update('negotiable', e.target.value)}>
                <option value="">Vyberte</option>
                <option>ano</option>
                <option>ne</option>
              </select>
            </div>
          </div>

          <label>Text inzerátu *</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={8} />
          <div style={{ fontSize: 13, color: '#666' }}>
            Tip: Uveďte stav vozidla, servisní historii, počet majitelů a jasnou informaci o tom, co je součástí prodeje. V popisu můžete také vložit detailní informace o vadách.
          </div>

          <label>Kontaktní informace *</label>
          <input placeholder="Jméno a příjmení" value={form.sellerName} onChange={e => update('sellerName', e.target.value)} />
          <input placeholder="Telefon nebo email" value={form.contact} onChange={e => update('contact', e.target.value)} />

          <label>Dodatečné informace (důvod prodeje, STK/emeise)</label>
          <input value={form.reason} onChange={e => update('reason', e.target.value)} />
          <input placeholder="Platnost STK / emise" value={form.inspection} onChange={e => update('inspection', e.target.value)} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button primary" type="submit">Odeslat inzerát</button>
            <button className="button" type="button" onClick={() => { setForm(initial); setPreviews([]); }}>Reset</button>
          </div>
        </div>
      </form>
    </main>
  );
}
