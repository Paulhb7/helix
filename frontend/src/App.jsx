import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Landing from './components/Landing';
import CheckPage from './components/CheckPage';
import About from './components/About';
import Methodology from './components/Methodology';
import Footer from './components/Footer';
import FormerReport from './components/FormerReport';
import FormerReportsPage from './components/FormerReportsPage';
import HelixDecoration from './components/HelixDecoration';

function LandingRoute() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <Landing onStart={() => navigate('/check')} />
    </>
  );
}

function CheckRoute() {
  return (
    <>
      <Header />
      <main className="has-helix-bg">
        <HelixDecoration />
        <CheckPage />
      </main>
      <Footer />
    </>
  );
}

function AboutRoute() {
  return (
    <>
      <Header />
      <main className="has-helix-bg">
        <HelixDecoration />
        <About />
      </main>
      <Footer />
    </>
  );
}

function MethodologyRoute() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="has-helix-bg">
        <HelixDecoration />
        <Methodology onBack={() => navigate(-1)} />
      </main>
      <Footer />
    </>
  );
}

function ReportRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="has-helix-bg">
        <HelixDecoration />
        <div className="app-view">
          <FormerReport id={id} onBack={() => navigate('/reports')} />
        </div>
      </main>
      <Footer />
    </>
  );
}

function ReportsRoute() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="has-helix-bg">
        <HelixDecoration />
        <div className="app-view">
          <FormerReportsPage
            onOpen={(id) => navigate(`/reports/${id}`)}
            onBack={() => navigate('/check')}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/check" element={<CheckRoute />} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="/methodology" element={<MethodologyRoute />} />
        <Route path="/reports" element={<ReportsRoute />} />
        <Route path="/reports/:id" element={<ReportRoute />} />
        <Route path="*" element={<LandingRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
