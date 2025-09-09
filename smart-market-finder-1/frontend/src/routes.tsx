import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const AddAd = lazy(() => import('./pages/AddAd'));
const Subscribe = lazy(() => import('./pages/Subscribe'));
const Listing = lazy(() => import('./pages/Listing'));

const PageRoutes = () => (
  <Suspense fallback={<div aria-busy="true">Loading...</div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/listing" element={<Listing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/add" element={<AddAd />} />
      <Route path="/subscribe" element={<Subscribe />} />
    </Routes>
  </Suspense>
);

export default PageRoutes;
