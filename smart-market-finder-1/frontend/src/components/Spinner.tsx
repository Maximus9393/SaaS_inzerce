import React from 'react';

export default function Spinner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="spinner-overlay">
      <div className="spinner" />
      {children}
    </div>
  );
}
