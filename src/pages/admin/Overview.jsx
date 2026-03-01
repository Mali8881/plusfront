import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { usersAPI } from '../../api/auth';
import { auditAPI, feedbackAPI, onboardingAPI } from '../../api/content';

export default function AdminOverview() {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersRes, auditRes, feedbackRes, reportsRes] = await Promise.all([
          usersAPI.list(),
          auditAPI.list().catch(() => ({ data: [] })),
          feedbackAPI.list().catch(() => ({ data: [] })),
          onboardingAPI.getReports().catch(() => ({ data: [] })),
        ]);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        setAudit(Array.isArray(auditRes.data) ? auditRes.data : []);
        setFeedback(Array.isArray(feedbackRes.data) ? feedbackRes.data : []);
        setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      } catch (e) {
        setError(e.response?.data?.detail || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ overview.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.is_active).length;
    const interns = users.filter((u) => u.role === 'intern').length;
    const admins = users.filter((u) => u.role === 'department_head' || u.role === 'admin' || u.role === 'superadmin').length;
    const sentReports = reports.filter((r) => String(r.status || '').toUpperCase() === 'SENT').length;
    const newFeedback = feedback.filter((f) => f.status === 'new').length;
    return { activeUsers, interns, admins, sentReports, newFeedback };
  }, [users, reports, feedback]);

  return (
    <MainLayout title="РђРґРјРёРЅ-РїР°РЅРµР»СЊ">
      <div className="page-header">
        <div>
          <div className="page-title">РћР±Р·РѕСЂ СЃРёСЃС‚РµРјС‹</div>
          <div className="page-subtitle">РљР»СЋС‡РµРІС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё Рё РїРѕСЃР»РµРґРЅРёРµ СЃРѕР±С‹С‚РёСЏ</div>
        </div>
      </div>

      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {loading && <div className="card"><div className="card-body">Р—Р°РіСЂСѓР·РєР°...</div></div>}

      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Metric title="РџРѕР»СЊР·РѕРІР°С‚РµР»Рё" value={users.length} />
            <Metric title="РђРєС‚РёРІРЅС‹Рµ" value={stats.activeUsers} />
            <Metric title="РЎС‚Р°Р¶РµСЂС‹" value={stats.interns} />
            <Metric title="РђРґРјРёРЅС‹" value={stats.admins} />
            <Metric title="РћС‚С‡РµС‚С‹ SENT" value={stats.sentReports} />
          </div>

          <div className="grid-2" style={{ gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">РџРѕСЃР»РµРґРЅРёРµ СЃРѕР±С‹С‚РёСЏ Р°СѓРґРёС‚Р°</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Р’Р Р•РњРЇ</th><th>ACTOR</th><th>ACTION</th><th>LEVEL</th></tr>
                  </thead>
                  <tbody>
                    {audit.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td>{String(row.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                        <td>{row.actor_username || '-'}</td>
                        <td>{row.action}</td>
                        <td>{row.level || '-'}</td>
                      </tr>
                    ))}
                    {audit.length === 0 && (
                      <tr><td colSpan={4}>РЎРѕР±С‹С‚РёР№ РїРѕРєР° РЅРµС‚.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">РћС‡РµСЂРµРґСЊ РѕР±СЂР°С‚РЅРѕР№ СЃРІСЏР·Рё</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>ID</th><th>РўРРџ</th><th>РЎРўРђРўРЈРЎ</th><th>РЎРћР—Р”РђРќРћ</th></tr>
                  </thead>
                  <tbody>
                    {feedback.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.type}</td>
                        <td>{row.status}</td>
                        <td>{String(row.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                    {feedback.length === 0 && (
                      <tr><td colSpan={4}>РћР±СЂР°С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="card-body" style={{ paddingTop: 0, color: 'var(--gray-500)', fontSize: 12 }}>
                РќРѕРІС‹Рµ: {stats.newFeedback}
              </div>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}

function Metric({ title, value }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

