import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Analytics from './Analytics';

function App() {
  const [desks, setDesks] = useState([]);
  const [stats, setStats] = useState({ free: 12, occupied: 0, away: 0, abandoned: 0, total: 12, hoursSaved: 0 });
  const [selectedDeskId, setSelectedDeskId] = useState('A1');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  const [timeLeft, setTimeLeft] = useState('');
  const [awayTimeLeft, setAwayTimeLeft] = useState('');
  const [graceTimeLeft, setGraceTimeLeft] = useState('');

  const [path, setPath] = useState(window.location.pathname);
  const wsRef = useRef(null);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to) => {
    window.history.pushState(null, '', to);
    setPath(to);
  };

  useEffect(() => {
    fetchDesks();
    connectWebSocket();

    const pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchDesks();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const deskIdFromPath = path.startsWith('/desk/') ? path.substring(6) : null;
  const activeDesk = deskIdFromPath ? desks.find(d => d.id === deskIdFromPath) : desks.find(d => d.id === selectedDeskId);

  useEffect(() => {
    setTimeLeft('');
    setAwayTimeLeft('');
    setGraceTimeLeft('');
  }, [activeDesk?.id, activeDesk?.status]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (!activeDesk || !activeDesk.session) {
        setTimeLeft('');
        setAwayTimeLeft('');
        setGraceTimeLeft('');
        return;
      }

      const now = new Date();
      const session = activeDesk.session;

      if (activeDesk.status === 'away' && session.awayExpiresAt) {
        const diff = new Date(session.awayExpiresAt) - now;
        if (diff > 0) {
          setAwayTimeLeft(formatTime(diff));
        } else {
          setAwayTimeLeft('Expired');
        }
      } else {
        setAwayTimeLeft('');
      }

      if (session.expiresAt) {
        const diff = new Date(session.expiresAt) - now;
        if (diff > 0) {
          if (session.prompted) {
            setGraceTimeLeft(formatTime(diff));
            setTimeLeft('');
          } else {
            setTimeLeft(formatTime(diff));
            setGraceTimeLeft('');
          }
        } else {
          setTimeLeft('Expired');
          setGraceTimeLeft('Expired');
        }
      }
    }, 500);

    return () => clearInterval(timerInterval);
  }, [activeDesk, desks]);

  const formatTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const fetchDesks = async () => {
    try {
      const res = await fetch('/api/desks');
      if (!res.ok) return;
      const data = await res.json();
      setDesks(data);
      updateStatsLocal(data);
    } catch (err) {
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = window.location.port === '5173'
      ? 'ws://localhost:5001'
      : `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'DESK_UPDATE') {
          setDesks(message.desks);
          setStats(message.stats);
        }
      } catch (err) {
        console.error(err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
  };

  const updateStatsLocal = (deskList) => {
    const newStats = { free: 0, occupied: 0, away: 0, abandoned: 0, total: deskList.length, hoursSaved: stats.hoursSaved || 0 };
    deskList.forEach(d => {
      if (d.status === 'free') newStats.free++;
      else if (d.status === 'occupied') newStats.occupied++;
      else if (d.status === 'away') newStats.away++;
      else if (d.status === 'abandoned') newStats.abandoned++;
    });

    fetch('/api/analytics')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(analytics => {
        setStats({ ...newStats, hoursSaved: analytics.hoursSaved != null ? analytics.hoursSaved : 0 });
      })
      .catch(() => setStats(prev => ({ ...newStats, hoursSaved: prev.hoursSaved || 0 })));
  };

  const apiCall = async (url, method = 'POST', body = {}) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Operation failed');
        return null;
      }
      fetchDesks();
      return data;
    } catch (err) {
      console.error(err);
      alert('Connection error');
      return null;
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!studentIdInput.trim()) {
      alert('Please enter your student ID');
      return;
    }
    const deskId = deskIdFromPath || selectedDeskId;
    const res = await apiCall(`/api/desks/${deskId}/checkin`, 'POST', { studentId: studentIdInput });
    if (res) {
      setStudentIdInput('');
    }
  };

  const handleAway = () => {
    const deskId = deskIdFromPath || selectedDeskId;
    return apiCall(`/api/desks/${deskId}/away`);
  };

  const handleBack = () => {
    const deskId = deskIdFromPath || selectedDeskId;
    return apiCall(`/api/desks/${deskId}/back`);
  };

  const handlePing = () => {
    const deskId = deskIdFromPath || selectedDeskId;
    return apiCall(`/api/desks/${deskId}/ping`);
  };

  const handleCheckout = () => {
    const deskId = deskIdFromPath || selectedDeskId;
    return apiCall(`/api/desks/${deskId}/checkout`);
  };

  const handleLibrarianReset = (deskId) => {
    return apiCall(`/api/desks/${deskId}/reset`);
  };

  if (deskIdFromPath) {
    if (!activeDesk) {
      return (
        <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%vh' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <h2>Desk Not Found</h2>
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
              Return to Floor Map
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
          <div className="panel-header" style={{ position: 'relative' }}>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'block', marginBottom: '15px', fontWeight: '600' }}>
              Return to Library Map
            </button>
            <h2>{activeDesk.name}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Zone: {activeDesk.zone}
            </p>
          </div>

          <div className="panel-body" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Seat Status:</span>
              <span className={`status-pill ${activeDesk.status}`}>
                {activeDesk.status}
              </span>
            </div>

            {activeDesk.status === 'free' && (
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                  You have scanned the QR code for {activeDesk.name}. Enter your Student ID below to secure this desk.
                </p>
                <form onSubmit={handleCheckIn} className="form-group">
                  <label htmlFor="student-id" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Student ID Card Number</label>
                  <input
                    type="text"
                    id="student-id"
                    className="form-input"
                    placeholder="e.g. U-4091"
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    style={{ marginTop: '8px', marginBottom: '15px' }}
                  />
                  <button type="submit" className="btn btn-primary">
                    Book This Desk
                  </button>
                </form>
              </div>
            )}

            {activeDesk.status === 'occupied' && activeDesk.session && (
              <div style={{ display: 'flex', flexParagraph: 'column', flexDirection: 'column', gap: '15px' }}>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Occupied by: </span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{activeDesk.session.studentId}</strong>
                </div>

                {activeDesk.session.prompted ? (
                  <div className="prompt-card">
                    <h4>Verification Required</h4>
                    <p>Are you still utilizing this desk? Confirm presence to keep booking.</p>
                    <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-title)', color: '#ef4444', fontWeight: 'bold' }}>
                      Auto-release in: {graceTimeLeft || '00:00'}
                    </div>
                    <button onClick={handlePing} className="btn btn-primary" style={{ background: '#10b981', boxShadow: '0 4px 10px rgba(16,185,129,0.3)', border: 'none' }}>
                      Confirm I am Still Here
                    </button>
                  </div>
                ) : (
                  <div className="timer-container">
                    <div className="timer-ring active">
                      <span className="timer-value">{timeLeft || '02:00:00'}</span>
                      <span className="timer-label">Session Remaining</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={handleAway} className="btn btn-warning" style={{ flex: 1.2 }}>
                    Step Away (20m)
                  </button>
                  <button onClick={handleCheckout} className="btn btn-danger" style={{ flex: 1 }}>
                    Check Out
                  </button>
                </div>
              </div>
            )}

            {activeDesk.status === 'away' && activeDesk.session && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  You are marked as away. Return within 20 minutes to keep this desk.
                </p>

                <div className="timer-container">
                  <div className="timer-ring away">
                    <span className="timer-value">{awayTimeLeft || '20:00'}</span>
                    <span className="timer-label">Away Remaining</span>
                  </div>
                </div>

                <button onClick={handleBack} className="btn btn-success">
                  Resume Seating
                </button>
              </div>
            )}

            {activeDesk.status === 'abandoned' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="prompt-card" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.4)', animation: 'none' }}>
                  <h4 style={{ color: '#ef4444' }}>Session Abandoned</h4>
                  <p style={{ fontSize: '0.85rem' }}>This desk was marked as abandoned because the student did not verify presence. A librarian has been notified to clear belongings.</p>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  If you are the new student at this desk, you can reset it and check in.
                </p>
                <button onClick={() => handleLibrarianReset(activeDesk.id)} className="btn btn-success">
                  Clear & Book Desk
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (path === '/analytics') {
    return <Analytics navigate={navigate} />;
  }

  if (path === '/admin') {
    return (
      <div className="app-container">
        <header>
          <div className="logo-section">
            <h1 id="app-logo">DeskGuard Admin</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Library Seat Enforcement Console
            </p>
          </div>
          <div className="header-controls">
            <button className="btn btn-secondary" onClick={() => navigate('/analytics')} style={{ width: 'auto', padding: '8px 16px' }}>
              Analytics
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ width: 'auto', padding: '8px 16px' }}>
              Floor Map
            </button>
          </div>
        </header>

        <div className="metrics-row">
          <div className="metric-card saved">
            <span className="metric-label">Saved Seating Time</span>
            <div className="metric-value">
              {stats.hoursSaved} <span className="metric-unit">Hours Recycled</span>
            </div>
          </div>

          <div className="metric-card alert">
            <span className="metric-label">Abandoned Desks</span>
            <div className="metric-value">
              {stats.abandoned} <span className="metric-unit">Alerts Active</span>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-label">Library Seating Load</span>
            <div className="metric-value">
              {Math.round(((stats.occupied + stats.away + stats.abandoned) / stats.total) * 100)}%
              <span className="metric-unit">({stats.occupied + stats.away + stats.abandoned} / {stats.total})</span>
            </div>
          </div>
        </div>

        <div className="main-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="card">
            <div className="admin-header">
              <h3>Active Anti-Hoarding Violations</h3>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Desk ID</th>
                    <th>Zone</th>
                    <th>Student ID</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {desks.filter(d => d.status === 'abandoned' || d.status === 'away').length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                        No hoarding violations detected.
                      </td>
                    </tr>
                  ) : (
                    desks.filter(d => d.status === 'abandoned' || d.status === 'away').map(desk => (
                      <tr key={desk.id}>
                        <td><strong>{desk.name}</strong></td>
                        <td>{desk.zone}</td>
                        <td>{desk.session ? desk.session.studentId : 'N/A'}</td>
                        <td>
                          <span className={`status-pill ${desk.status}`}>
                            {desk.status}
                          </span>
                        </td>
                        <td>
                          {desk.status === 'abandoned' ? (
                            <button
                              onClick={() => handleLibrarianReset(desk.id)}
                              className="btn btn-success"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                            >
                              Reset Seat
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Awaiting Timer</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>All Seats Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {desks.map(desk => (
                <div
                  key={desk.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>{desk.name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({desk.zone})</span>
                  </div>
                  <span className={`status-pill ${desk.status}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {desk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedDesk = desks.find(d => d.id === selectedDeskId);

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <h1 id="app-logo">DeskGuard Seating Portal</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Real-Time Library Floor Plan
          </p>
        </div>
        <div className="header-controls">
          <button className="btn btn-secondary" onClick={() => navigate('/analytics')} style={{ width: 'auto', padding: '8px 16px' }}>
            Analytics
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin')} style={{ width: 'auto', padding: '8px 16px' }}>
            Librarian Console
          </button>
        </div>
      </header>

      <div className="main-grid">
        <div className="card">
          <div className="map-title">
            <h3>Library Floor Map</h3>
          </div>

          <div className="map-svg-container">
            <svg viewBox="0 0 800 450" className="svg-map">
              <rect x="10" y="10" width="780" height="430" rx="15" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="3" />
              <line x1="260" y1="10" x2="260" y2="440" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2" strokeDasharray="5" />
              <line x1="540" y1="10" x2="540" y2="440" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2" strokeDasharray="5" />

              <text x="135" y="40" fill="var(--text-muted)" fontSize="14" fontWeight="600" textAnchor="middle">Reading Area A</text>
              <text x="400" y="40" fill="var(--text-muted)" fontSize="14" fontWeight="600" textAnchor="middle">Reading Area B</text>
              <text x="670" y="40" fill="var(--text-muted)" fontSize="14" fontWeight="600" textAnchor="middle">Reading Area C</text>

              <rect x="50" y="100" width="60" height="60" rx="8" className={`svg-desk desk-${desks.find(d => d.id === 'A1')?.status || 'free'} ${selectedDeskId === 'A1' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('A1')} />
              <text x="80" y="135" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">A1</text>

              <rect x="150" y="100" width="60" height="60" rx="8" className={`svg-desk desk-${desks.find(d => d.id === 'A2')?.status || 'free'} ${selectedDeskId === 'A2' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('A2')} />
              <text x="180" y="135" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">A2</text>

              <rect x="50" y="240" width="60" height="60" rx="8" className={`svg-desk desk-${desks.find(d => d.id === 'A3')?.status || 'free'} ${selectedDeskId === 'A3' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('A3')} />
              <text x="80" y="275" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">A3</text>

              <rect x="150" y="240" width="60" height="60" rx="8" className={`svg-desk desk-${desks.find(d => d.id === 'A4')?.status || 'free'} ${selectedDeskId === 'A4' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('A4')} />
              <text x="180" y="275" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">A4</text>

              <rect x="300" y="90" width="50" height="70" rx="4" className={`svg-desk desk-${desks.find(d => d.id === 'B1')?.status || 'free'} ${selectedDeskId === 'B1' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('B1')} />
              <text x="325" y="130" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">B1</text>

              <rect x="300" y="220" width="50" height="70" rx="4" className={`svg-desk desk-${desks.find(d => d.id === 'B2')?.status || 'free'} ${selectedDeskId === 'B2' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('B2')} />
              <text x="325" y="260" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">B2</text>

              <rect x="440" y="90" width="50" height="70" rx="4" className={`svg-desk desk-${desks.find(d => d.id === 'B3')?.status || 'free'} ${selectedDeskId === 'B3' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('B3')} />
              <text x="465" y="130" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">B3</text>

              <rect x="440" y="220" width="50" height="70" rx="4" className={`svg-desk desk-${desks.find(d => d.id === 'B4')?.status || 'free'} ${selectedDeskId === 'B4' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('B4')} />
              <text x="465" y="260" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">B4</text>

              <rect x="580" y="100" width="70" height="60" rx="10" className={`svg-desk desk-${desks.find(d => d.id === 'C1')?.status || 'free'} ${selectedDeskId === 'C1' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('C1')} />
              <text x="615" y="135" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">C1</text>

              <rect x="690" y="100" width="70" height="60" rx="10" className={`svg-desk desk-${desks.find(d => d.id === 'C2')?.status || 'free'} ${selectedDeskId === 'C2' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('C2')} />
              <text x="725" y="135" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">C2</text>

              <rect x="580" y="240" width="70" height="60" rx="10" className={`svg-desk desk-${desks.find(d => d.id === 'C3')?.status || 'free'} ${selectedDeskId === 'C3' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('C3')} />
              <text x="615" y="275" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">C3</text>

              <rect x="690" y="240" width="70" height="60" rx="10" className={`svg-desk desk-${desks.find(d => d.id === 'C4')?.status || 'free'} ${selectedDeskId === 'C4' ? 'desk-selected' : ''}`} onClick={() => setSelectedDeskId('C4')} />
              <text x="725" y="275" fill="var(--text-main)" fontSize="12" fontWeight="bold" textAnchor="middle" pointerEvents="none">C4</text>
            </svg>
          </div>

          <div className="legend-grid">
            <div className="legend-item">
              <span className="legend-color free"></span>
              <span className="legend-label">Free ({stats.free})</span>
            </div>
            <div className="legend-item">
              <span className="legend-color occupied"></span>
              <span className="legend-label">Occupied ({stats.occupied})</span>
            </div>
            <div className="legend-item">
              <span className="legend-color away"></span>
              <span className="legend-label">Away ({stats.away})</span>
            </div>
            <div className="legend-item">
              <span className="legend-color abandoned"></span>
              <span className="legend-label">Abandoned ({stats.abandoned})</span>
            </div>
          </div>
        </div>

        <div className="card">
          {selectedDesk ? (
            <>
              <div className="panel-header">
                <h2>{selectedDesk.name}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Zone: {selectedDesk.zone}
                </p>
              </div>

              <div className="panel-body" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Status:</span>
                  <span className={`status-pill ${selectedDesk.status}`}>
                    {selectedDesk.status}
                  </span>
                </div>

                {selectedDesk.status === 'free' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      To check in, scan the desk QR code with your phone or simulate scan below.
                    </p>

                    <div style={{ border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <svg viewBox="0 0 100 100" width="120" height="120" style={{ background: '#fff', padding: '8px', borderRadius: '4px' }}>
                        <path d="M 0 0 h 30 v 30 h -30 z M 10 10 h 10 v 10 h -10 z M 70 0 h 30 v 30 h -30 z M 80 10 h 10 v 10 h -10 z M 0 70 h 30 v 30 h -30 z M 10 80 h 10 v 10 h -10 z M 40 40 h 20 v 20 h -20 z M 40 10 h 10 v 20 h -10 z M 80 40 h 10 v 10 h -10 z M 50 80 h 20 v 10 h -20 z M 80 80 h 20 v 20 h -20 z" fill="#000" />
                      </svg>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>DESK QR CODE</span>
                    </div>

                    <button className="btn btn-primary" onClick={() => navigate(`/desk/${selectedDesk.id}`)}>
                      Simulate QR Scan (Check In)
                    </button>
                  </div>
                )}

                {selectedDesk.status === 'occupied' && selectedDesk.session && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Booked by: </span>
                      <strong>{selectedDesk.session.studentId}</strong>
                    </div>

                    {selectedDesk.session.prompted ? (
                      /* Prompted / verification-in-progress state */
                      <div className="prompt-card" style={{ animation: 'none' }}>
                        <h4>Verification in Progress</h4>
                        <p>Student has been asked to confirm presence. Auto-releasing in:</p>
                        <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 700, color: '#c2410c' }}>
                          {graceTimeLeft || '—'}
                        </div>
                      </div>
                    ) : timeLeft === 'Expired' ? (
                      /* Session time has expired, waiting for sweeper */
                      <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, color: 'var(--status-occupied)', marginBottom: 6 }}>Session Expired</div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>This session has expired. The desk will be freed shortly by the system sweeper.</p>
                      </div>
                    ) : (
                      /* Normal session — show countdown */
                      <div className="timer-container">
                        <div className="timer-ring active">
                          <span className="timer-value">{timeLeft || '—'}</span>
                          <span className="timer-label">Session Remaining</span>
                        </div>
                      </div>
                    )}

                    <button className="btn btn-secondary" onClick={() => navigate(`/desk/${selectedDesk.id}`)}>
                      Manage Booking (Simulate Student Scan)
                    </button>
                  </div>
                )}

                {selectedDesk.status === 'away' && selectedDesk.session && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Student {selectedDesk.session.studentId} is temporarily away.
                    </p>

                    <div className="timer-container">
                      <div className="timer-ring away">
                        <span className="timer-value">{awayTimeLeft || '20:00'}</span>
                        <span className="timer-label">Away Remaining</span>
                      </div>
                    </div>

                    <button className="btn btn-secondary" onClick={() => navigate(`/desk/${selectedDesk.id}`)}>
                      Manage Booking (Simulate Student Scan)
                    </button>
                  </div>
                )}

                {selectedDesk.status === 'abandoned' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>Session Abandoned</div>
                      <p style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>This seat was auto-released due to hoarding. A librarian has been notified to clear physical belongings.</p>
                    </div>

                    <button className="btn btn-success" onClick={() => navigate(`/desk/${selectedDesk.id}`)}>
                      Book This Seat
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Select a desk from the map to inspect status.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
