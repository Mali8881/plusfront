import { useEffect, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { attendanceAPI } from '../../api/content';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = {
  TEAMLEAD: 'Тимлид',
  DEPARTMENT_HEAD: 'Руководитель отдела',
  EMPLOYEE: 'Сотрудник',
  INTERN: 'Стажер',
  ADMIN: 'Админ',
  ADMINISTRATOR: 'Администратор',
  SUPER_ADMIN: 'Суперадмин',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return '—';
  }
}

export default function AttendanceMarks() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = ['projectmanager', 'department_head', 'admin', 'administrator', 'superadmin'].includes(String(user?.role || '').toLowerCase());

  const load = async (targetDate = date) => {
    setLoading(true);
    setError('');
    try {
      const res = await attendanceAPI.checkinsReport({ date: targetDate });
      const list = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e.response?.data?.detail || 'Не удалось загрузить отметки.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    load(date);
  }, [date, canView]);

  return (
    <MainLayout title="Отметки сотрудников">
      <div className="page-header">
        <div>
          <div className="page-title">Отметки сотрудников</div>
          <div className="page-subtitle">Кто отметился, график смены и опоздание</div>
        </div>
      </div>

      {!canView ? (
        <div className="card"><div className="card-body">У вас нет доступа к этому разделу.</div></div>
      ) : (
        <>
          {error ? <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: 'var(--danger)' }}>{error}</div></div> : null}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Дата</label>
                <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => load(date)}>Обновить</button>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Роль</th>
                    <th>Отдел</th>
                    <th>Подотдел</th>
                    <th>График</th>
                    <th>Отметился</th>
                    <th>Статус</th>
                    <th>Опоздание</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={8}>Загрузка...</td></tr> : null}
                  {!loading && rows.map((row) => (
                    <tr key={row.user_id}>
                      <td>{row.full_name || row.username}</td>
                      <td>{ROLE_LABELS[row.role] || row.role || '-'}</td>
                      <td>{row.department || '-'}</td>
                      <td>{row.subdivision || '-'}</td>
                      <td>{row.shift_from && row.shift_to ? `${row.shift_from} - ${row.shift_to}` : 'Выходной / не задан'}</td>
                      <td>{fmtDateTime(row.checked_at)}</td>
                      <td>{row.mark_status || 'Не отметился'}</td>
                      <td>{row.late_minutes != null ? `${row.late_minutes} мин` : '-'}</td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 ? <tr><td colSpan={8}>За выбранную дату данных нет.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
