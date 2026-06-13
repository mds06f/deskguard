import React, { useState, useEffect, useRef } from 'react';

/* ─── tiny inline helpers ───────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`status-pill ${status}`}>{status}</span>
  );
}

/* ─── Sparkline bar chart (pure SVG, no lib) ─────────── */
function BarChart({ bars, maxVal, color }) {
  const h = 56;
  const w = 100;
  const n = bars.length;
  const barW = Math.floor((w - (n - 1) * 3) / n);
  const mx = maxVal || Math.max(...bars, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block' }}>
      {bars.map((v, i) => {
        const barH = Math.max(2, Math.round((v / mx) * h));
        const x = i * (barW + 3);
        const y = h - barH;
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH}
            rx={2}
            fill={color || 'var(--color-primary)'}
            fillOpacity={0.75 + (v / mx) * 0.25}
          />
        );
      })}
    </svg>
  );
}

/* ─── Donut / radial fill (pure SVG) ────────────────── */
function RadialProgress({ pct, color, size = 80, label }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(0,0,0,0.07)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22} fontWeight={700} fill={color}>
        {pct}%
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + size * 0.22} textAnchor="middle"
          fontSize={size * 0.13} fill="var(--text-muted)">
          {label}
        </text>
      )}
    </svg>
  );
}

/* ─── Main Analytics Component ───────────────────────── */
export default function Analytics({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/full');
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    intervalRef.current = setInterval(fetchAnalytics, 15000); // auto-refresh every 15s
    return () => clearInterval(intervalRef.current);
  }, []);

  if (loading) return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.4 }}>⏳</div>
        <p>Loading analytics…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--status-occupied)', marginBottom: 10 }}>Could not load analytics</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchAnalytics}>Retry</button>
      </div>
    </div>
  );

  const { live, allTime, today, perDesk, perZone, topDesks, recentSessions } = data;
  const totalActive = live.occupied + live.away + live.abandoned;

  // Build per-zone bar values (sessions per zone) for bar chart
  const zoneBars = perZone.map(z => z.totalSessions);
  const maxZone = Math.max(...zoneBars, 1);

  // per-desk session bars for top-desks
  const topMax = Math.max(...topDesks.map(d => d.sessions), 1);

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header>
        <div className="logo-section">
          <h1 id="analytics-logo">Analytics Dashboard</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Library Seat Intelligence — auto-refreshes every 15s
            {lastRefresh && (
              <span style={{ marginLeft: 10, opacity: 0.6 }}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="header-controls">
          <button className="btn btn-secondary" onClick={fetchAnalytics} style={{ width: 'auto', padding: '8px 16px' }}>
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin')} style={{ width: 'auto', padding: '8px 16px' }}>
            Librarian Console
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ width: 'auto', padding: '8px 16px' }}>
            Floor Map
          </button>
        </div>
      </header>

      {/* ── Row 1: Live Snapshot ── */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          Live Snapshot
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[
            { label: 'Free', value: live.free, color: 'var(--status-free)', bg: 'var(--status-free-bg)' },
            { label: 'Occupied', value: live.occupied, color: 'var(--status-occupied)', bg: 'var(--status-occupied-bg)' },
            { label: 'Away', value: live.away, color: 'var(--status-away)', bg: 'var(--status-away-bg)' },
            { label: 'Abandoned', value: live.abandoned, color: 'var(--status-abandoned)', bg: 'var(--status-abandoned-bg)' },
            { label: 'Occupancy', value: `${live.occupancyRate}%`, color: 'var(--color-primary)', bg: 'rgba(37,99,235,0.07)', sub: `${totalActive}/${live.total} desks` },
          ].map(({ label, value, color, bg, sub }) => (
            <div key={label} className="card" style={{ padding: '18px 20px', borderLeft: `3px solid ${color}`, background: `linear-gradient(135deg, white 0%, ${bg} 100%)` }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>
                {value}
              </div>
              {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Row 2: Today + All-Time + Occupancy ring ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 20, marginBottom: 28 }}>
        {/* Today */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            Today
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Sessions Started', value: today.sessionsToday },
              { label: 'Unique Students', value: today.uniqueStudentsToday },
              { label: 'Abandoned Today', value: today.abandonedToday, warn: today.abandonedToday > 0 },
            ].map(({ label, value, warn }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: warn && value > 0 ? 'rgba(249,115,22,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: 8, border: warn && value > 0 ? '1px solid rgba(249,115,22,0.25)' : '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 700, color: warn && value > 0 ? 'var(--status-abandoned)' : 'var(--text-main)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All-Time */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            All-Time
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Total Sessions', value: allTime.totalSessions },
              { label: 'Completed', value: allTime.completedSessions },
              { label: 'Hours Reclaimed', value: `${allTime.hoursSaved}h`, accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: accent ? 'rgba(37,99,235,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 8, border: accent ? '1px solid rgba(37,99,235,0.2)' : '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--text-main)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Radial occupancy + abandonment */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <RadialProgress pct={live.occupancyRate} color="var(--color-primary)" size={96} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>Occupancy Rate</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <RadialProgress pct={allTime.abandonmentRate} color="var(--status-abandoned)" size={96} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>Abandonment Rate</div>
          </div>
        </div>
      </section>

      {/* ── Row 3: Zone Breakdown + Top Desks ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Zone breakdown */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            Zone Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {perZone.map(z => {
              const utilPct = z.deskCount > 0 ? Math.round((z.activeDesks / z.deskCount) * 100) : 0;
              return (
                <div key={z.zone}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{z.zone}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {z.activeDesks}/{z.deskCount} active · {z.totalSessions} total sessions
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${utilPct}%`,
                      background: utilPct > 75 ? 'var(--status-occupied)' : utilPct > 40 ? 'var(--status-away)' : 'var(--status-free)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {utilPct}% utilisation · {z.abandonedSessions} abandonment{z.abandonedSessions !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top desks */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            Most Booked Desks
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topDesks.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.78rem',
                  background: i === 0 ? 'rgba(37,99,235,0.12)' : 'rgba(0,0,0,0.05)',
                  color: i === 0 ? 'var(--color-primary)' : 'var(--text-muted)'
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.sessions} sessions</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.round((d.sessions / topMax) * 100)}%`,
                      background: 'var(--color-primary)',
                      opacity: 0.7 + (d.sessions / topMax) * 0.3,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{d.zone}</div>
                </div>
              </div>
            ))}
            {topDesks.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>
                No sessions recorded yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Row 4: Per-Desk Table ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            Per-Desk Breakdown
          </h3>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Desk</th>
                  <th>Zone</th>
                  <th>Current Status</th>
                  <th>Total Sessions</th>
                  <th>Completed</th>
                  <th>Abandoned</th>
                  <th>Abandon Rate</th>
                </tr>
              </thead>
              <tbody>
                {perDesk.map(d => {
                  const rate = d.totalSessions > 0 ? ((d.abandonedSessions / d.totalSessions) * 100).toFixed(0) : 0;
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{d.zone}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td style={{ fontWeight: 600 }}>{d.totalSessions}</td>
                      <td style={{ color: 'var(--status-free)' }}>{d.completedSessions}</td>
                      <td style={{ color: d.abandonedSessions > 0 ? 'var(--status-abandoned)' : 'var(--text-muted)' }}>
                        {d.abandonedSessions}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 48, height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3, width: `${rate}%`,
                              background: rate > 50 ? 'var(--status-occupied)' : rate > 20 ? 'var(--status-away)' : 'var(--status-free)',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Row 5: Recent Session Log ── */}
      <section style={{ marginBottom: 40 }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border-card)' }}>
            Recent Session Log
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
              (last 20 sessions)
            </span>
          </h3>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student ID</th>
                  <th>Desk</th>
                  <th>Zone</th>
                  <th>Started At</th>
                  <th>Expires At</th>
                  <th>Status</th>
                  <th>Prompted</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                      No sessions recorded yet.
                    </td>
                  </tr>
                ) : recentSessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{s.id}</td>
                    <td><strong>{s.student_id}</strong></td>
                    <td>{s.desk_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.zone}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtDate(s.expires_at)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.prompted ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--status-abandoned)', fontWeight: 600 }}>Yes</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
