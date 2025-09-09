import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import PageRoutes from './routes';

function App() {
  return (
    <ThemeProvider>
      <Layout>
        <PageRoutes />
      </Layout>
    </ThemeProvider>
  );
}

export default App;