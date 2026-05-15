import { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import Features from './components/Features.jsx';
import Footer from './components/Footer.jsx';
import DashboardPage  from './pages/DashboardPage.jsx';
import LiveFlightPage from './pages/LiveFlightPage.jsx';
import AnalysisPage   from './pages/AnalysisPage.jsx';
import './App.css';

export default function App() {
  const [page, setPage] = useState('home');

  return (
    <>
      <Navbar activePage={page} onNavigate={setPage} />

      {page === 'home' && (
        <main>
          <Hero onDashboard={() => setPage('dashboard')} />
          <Features />
          <Footer />
        </main>
      )}

      {page === 'dashboard'   && <DashboardPage />}
      {page === 'live-flight' && <LiveFlightPage />}
      {page === 'analysis'    && <AnalysisPage />}
    </>
  );
}
