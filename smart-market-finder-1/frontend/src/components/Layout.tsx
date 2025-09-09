import React from 'react';
import Header from './Header';
import BackendStatus from './BackendStatus';

type Props = {
  children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
  return (
    <div id="app-root">
      <Header />
      <main>
        <div className="container">
          <BackendStatus />
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
