import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, signInWithGoogle, signOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { WeekView } from './pages/WeekView';
import { PickDetail } from './pages/PickDetail';
import './styles.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="dk-loading">Loading...</div>;

  if (!user) {
    return (
      <div className="dk-login">
        <div className="dk-login-card">
          <div className="dk-logo">NewLeaf <span>Desk</span></div>
          <p>Publishing Dashboard</p>
          <button className="dk-btn dk-btn-primary" onClick={signInWithGoogle}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="dk-app">
        <header className="dk-header">
          <div className="dk-header-left">
            <div className="dk-logo">NewLeaf <span>Desk</span></div>
          </div>
          <div className="dk-header-right">
            <span className="dk-user">{user.email}</span>
            <button className="dk-btn dk-btn-sm" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="dk-main">
          <Routes>
            <Route path="/" element={<WeekView />} />
            <Route path="/pick/:tileId" element={<PickDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
