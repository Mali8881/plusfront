import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, Plus, Pencil, Trash2, RotateCcw, X, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { onboardingAPI } from '../../api/content';

const STATUS = {
  DRAFT: { label: 'Черновик', cls: 'badge-gray' },
  SENT: { label: 'Отправлен', cls: 'badge-blue' },
  ACCEPTED: { label: 'Принят', cls: 'badge-green' },
  REVISION: { label: 'На доработке', cls: 'badge-yellow' },
  REJECTED: { label: 'Отклонен', cls: 'badge-red' },
};

const MATERIAL_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'link', label: 'Ссылка' },
  { value: 'video', label: 'Видео (YouTube)' },
  { value: 'image', label: 'Изображение (URL)' },
  { value: 'file', label: 'Файл (URL)' },
];

const EMPTY_DAY = { day_number: '', title: '', goals: '', description: '', instructions: '', is_active: true };
const EMPTY_MATERIAL = { type: 'text', content: '' };

function extractError(e, fallback) {
  const d = e?.response?.data;
  if (!d) return fallback;
  if (typeof d.detail === 'string') return d.detail;
  if (typeof d === 'string') return d;
  if (typeof d === 'object') {
    const key = Object.keys(d)[0];
    const val = d[key];
    if (Array.isArray(val)) return `${key}: ${val[0]}`;
    if (typeof val === 'string') return `${key}: ${val}`;
  }
  return fallback;
}

// ─── Programme tab ─────────────────────────────────────────────────────────
function ProgrammeTab() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedDayId, setExpandedDayId] = useState(null);

  // day modal
  const [dayModal, setDayModal] = useState(null); // null | 'create' | {id, ...}
  const [dayForm, setDayForm] = useState(EMPTY_DAY);
  const [savingDay, setSavingDay] = useState(false);
  const [dayErr, setDayErr] = useState('');

  // material modal
  const [matModal, setMatModal] = useState(null); // null | dayId
  const [matForm, setMatForm] = useState(EMPTY_MATERIAL);
  const [savingMat, setSavingMat] = useState(false);
  const [matErr, setMatErr] = useState('');
  const [deletingMatId, setDeletingMatId] = useState(null);
  const [deletingDayId, setDeletingDayId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await onboardingAPI.adminListDays();
      setDays(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (e) {
      setError(extractError(e, 'Не удалось загрузить дни.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const openCreate = () => { setDayForm(EMPTY_DAY); setDayErr(''); setDayModal('create'); };
  const openEdit = (day) => { setDayForm({ day_number: day.day_number, title: day.title, goals: day.goals || '', description: day.description || '', instructions: day.instructions || '', is_active: day.is_active }); setDayErr(''); setDayModal(day); };

  const saveDay = async () => {
    if (!dayForm.day_number || !dayForm.title.trim()) { setDayErr('Укажите номер дня и название.'); return; }
    setSavingDay(true); setDayErr('');
    try {
      const payload = { day_number: Number(dayForm.day_number), title: dayForm.title.trim(), goals: dayForm.goals, description: dayForm.description, instructions: dayForm.instructions, is_active: dayForm.is_active };
      if (dayModal === 'create') {
        await onboardingAPI.adminCreateDay(payload);
        flash('День создан.');
      } else {
        await onboardingAPI.adminUpdateDay(dayModal.id, payload);
        flash('День обновлён.');
      }
      setDayModal(null);
      await load();
    } catch (e) {
      setDayErr(extractError(e, 'Не удалось сохранить.'));
    } finally {
      setSavingDay(false);
    }
  };

  const deleteDay = async (day) => {
    if (!window.confirm(`Удалить День ${day.day_number}: «${day.title}»?`)) return;
    setDeletingDayId(day.id);
    try {
      await onboardingAPI.adminDeleteDay(day.id);
      flash('День удалён.');
      await load();
    } catch (e) {
      setError(extractError(e, 'Не удалось удалить день.'));
    } finally {
      setDeletingDayId(null);
    }
  };

  const openMat = (dayId) => { setMatForm(EMPTY_MATERIAL); setMatErr(''); setMatModal(dayId); };

  const saveMat = async () => {
    if (!matForm.content.trim()) { setMatErr('Введите содержимое.'); return; }
    setSavingMat(true); setMatErr('');
    try {
      await onboardingAPI.adminCreateMaterial({ day: matModal, type: matForm.type, content: matForm.content.trim(), position: 0 });
      flash('Материал добавлен.');
      setMatModal(null);
      await load();
    } catch (e) {
      setMatErr(extractError(e, 'Не удалось добавить материал.'));
    } finally {
      setSavingMat(false);
    }
  };

  const deleteMat = async (matId) => {
    setDeletingMatId(matId);
    try {
      await onboardingAPI.adminDeleteMaterial(matId);
      flash('Материал удалён.');
      await load();
    } catch (e) {
      setError(extractError(e, 'Не удалось удалить материал.'));
    } finally {
      setDeletingMatId(null);
    }
  };

  return (
    <div>
      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {success && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#166534' }}>{success}</div></div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Дни онбординга ({days.length})</span>
          <button className="btn btn-primary btn-sm" type="button" onClick={openCreate}>
            <Plus size={14} /> Добавить день
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading && <div style={{ padding: 16, color: 'var(--gray-500)' }}>Загрузка...</div>}
          {!loading && days.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
              Программа онбординга пуста. Нажмите «Добавить день» чтобы начать.
            </div>
          )}
          {!loading && days.map((day) => {
            const isOpen = expandedDayId === day.id;
            return (
              <div key={day.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}
                  onClick={() => setExpandedDayId(isOpen ? null : day.id)}>
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, marginRight: 8 }}>День {day.day_number}</span>
                    <span style={{ fontSize: 13 }}>{day.title}</span>
                    {!day.is_active && <span style={{ marginLeft: 8, fontSize: 11, background: '#FEE2E2', color: '#B91C1C', padding: '1px 7px', borderRadius: 20 }}>неактивен</span>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--gray-500)', marginRight: 8 }}>{(day.materials || []).length} материалов</span>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={(e) => { e.stopPropagation(); openEdit(day); }}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" style={{ color: '#b91c1c' }}
                    onClick={(e) => { e.stopPropagation(); deleteDay(day); }} disabled={deletingDayId === day.id}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ padding: '0 16px 14px 40px', background: 'var(--gray-50)' }}>
                    {day.goals && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}><b>Цели:</b> {day.goals}</div>}
                    {day.description && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}><b>Описание:</b> {day.description}</div>}
                    {day.instructions && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}><b>Инструкции:</b> {day.instructions}</div>}

                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Материалы</div>
                    {(day.materials || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>Материалов нет.</div>}
                    {(day.materials || []).map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 10px' }}>
                        <span style={{ color: 'var(--gray-500)', minWidth: 60 }}>{MATERIAL_TYPES.find((t) => t.value === m.type)?.label || m.type}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content}</span>
                        <button className="btn-icon" type="button" style={{ color: '#b91c1c' }}
                          onClick={() => deleteMat(m.id)} disabled={deletingMatId === m.id} title="Удалить">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm" type="button" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); openMat(day.id); }}>
                      <Plus size={13} /> Добавить материал
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day modal */}
      {dayModal !== null && (
        <div className="modal-overlay" onClick={() => setDayModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{dayModal === 'create' ? 'Создать день онбординга' : `Редактировать День ${dayModal.day_number}`}</div>
              <button className="btn-icon" type="button" onClick={() => setDayModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {dayErr && <div style={{ color: '#b91c1c', marginBottom: 10, fontSize: 13 }}>{dayErr}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Номер дня *</label>
                  <input className="form-input" type="number" min="1" value={dayForm.day_number} onChange={(e) => setDayForm((f) => ({ ...f, day_number: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Название *</label>
                  <input className="form-input" placeholder="Первый день в компании" value={dayForm.title} onChange={(e) => setDayForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Цели дня</label>
                <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} placeholder="Что стажёр должен узнать и сделать" value={dayForm.goals} onChange={(e) => setDayForm((f) => ({ ...f, goals: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea className="form-input" rows={3} style={{ resize: 'vertical' }} placeholder="Подробное описание дня" value={dayForm.description} onChange={(e) => setDayForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Инструкции для стажёра</label>
                <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} placeholder="Конкретные шаги" value={dayForm.instructions} onChange={(e) => setDayForm((f) => ({ ...f, instructions: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={dayForm.is_active} onChange={(e) => setDayForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Активен (виден стажёрам)
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" type="button" onClick={saveDay} disabled={savingDay}>
                {savingDay ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setDayModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Material modal */}
      {matModal !== null && (
        <div className="modal-overlay" onClick={() => setMatModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Добавить материал</div>
              <button className="btn-icon" type="button" onClick={() => setMatModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {matErr && <div style={{ color: '#b91c1c', marginBottom: 10, fontSize: 13 }}>{matErr}</div>}
              <div className="form-group">
                <label className="form-label">Тип материала</label>
                <select className="form-select" value={matForm.type} onChange={(e) => setMatForm((f) => ({ ...f, type: e.target.value }))}>
                  {MATERIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{matForm.type === 'text' ? 'Текст' : 'URL'}</label>
                {matForm.type === 'text'
                  ? <textarea className="form-input" rows={4} style={{ resize: 'vertical' }} placeholder="Введите текст материала" value={matForm.content} onChange={(e) => setMatForm((f) => ({ ...f, content: e.target.value }))} />
                  : <input className="form-input" placeholder="https://..." value={matForm.content} onChange={(e) => setMatForm((f) => ({ ...f, content: e.target.value }))} />
                }
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" type="button" onClick={saveMat} disabled={savingMat}>
                {savingMat ? 'Добавляем...' : 'Добавить'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setMatModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports tab ───────────────────────────────────────────────────────────
function ReportsTab() {
  const [days, setDays] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [progressDetails, setProgressDetails] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [daysRes, reportsRes] = await Promise.all([
        onboardingAPI.listDays(),
        onboardingAPI.getReports(),
      ]);
      setDays(Array.isArray(daysRes.data) ? daysRes.data : []);
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить отчёты.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected?.user_id) { setProgressDetails(null); return; }
    (async () => {
      setProgressLoading(true);
      try {
        const res = await onboardingAPI.getInternProgress(selected.user_id);
        setProgressDetails(res.data || null);
      } catch { setProgressDetails(null); }
      finally { setProgressLoading(false); }
    })();
  }, [selected?.user_id]);

  const grouped = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      const key = `${r.user_id}:${r.full_name || r.username || r.user_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const [userId, name] = key.split(':');
      const done = items.filter((x) => String(x.status || '').toUpperCase() === 'ACCEPTED').length;
      return { userId, name, done, total: Math.max(days.length, items.length), items };
    });
  }, [reports, days]);

  const review = async (reportId, status) => {
    try {
      await onboardingAPI.reviewReport(reportId, { status, comment });
      setSelected(null);
      setComment('');
      setToast(status === 'ACCEPTED' ? 'Отчет принят' : status === 'REVISION' ? 'Отправлен на доработку' : 'Отчет отклонен');
      setTimeout(() => setToast(''), 2500);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось изменить статус отчета.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <div className="card"><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {loading && <div className="card"><div className="card-body">Загрузка...</div></div>}

      {!loading && (
        <>
          <div className="card">
            <div className="card-header"><span className="card-title">Прогресс стажеров</span></div>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              {grouped.map((item) => {
                const percent = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                return (
                  <div key={item.userId} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.done}/{item.total} дней принято</div>
                    </div>
                    <div style={{ height: 7, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: percent === 100 ? '#16A34A' : '#2563EB' }} />
                    </div>
                  </div>
                );
              })}
              {grouped.length === 0 && <div style={{ color: 'var(--gray-500)' }}>Отчетов пока нет.</div>}
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>СТАЖЕР</th><th>ДЕНЬ</th><th>ОБНОВЛЕНО</th><th>СТАТУС</th><th>ДЕЙСТВИЯ</th></tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name || r.username || r.user_id}</td>
                      <td>День {r.day_number}</td>
                      <td>{String(r.updated_at || '').slice(0, 16).replace('T', ' ')}</td>
                      <td><span className={`badge ${STATUS[r.status]?.cls || 'badge-gray'}`}>{STATUS[r.status]?.label || r.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => setSelected(r)} title="Просмотр"><Eye size={14} /></button>
                          {r.status === 'SENT' && (
                            <>
                              <button className="btn-icon" style={{ color: 'var(--success)' }} onClick={() => review(r.id, 'ACCEPTED')} title="Принять"><CheckCircle size={14} /></button>
                              <button className="btn-icon" style={{ color: 'var(--warning)' }} onClick={() => setSelected(r)} title="На доработку"><RotateCcw size={14} /></button>
                              <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => review(r.id, 'REJECTED')} title="Отклонить"><XCircle size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && <tr><td colSpan={5}>Отчетов пока нет.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Отчет: {selected.full_name || selected.username} · День {selected.day_number}</div>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <ViewBlock label="Что сделал" value={selected.did} />
              <ViewBlock label="Что буду делать" value={selected.will_do} />
              <ViewBlock label="Проблемы" value={selected.problems} />
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Детальный прогресс стажера</div>
                {progressLoading ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Загрузка...</div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                      День: {progressDetails?.overview?.current_day_number || '-'} | Выполнено: {progressDetails?.overview?.completed_days || 0}/{progressDetails?.overview?.total_days || 0}
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8 }}>
                      {(progressDetails?.regulations || []).map((item) => (
                        <div key={item.id} style={{ fontSize: 12, marginBottom: 6 }}>
                          День {item.day_number} • {item.title} • шаг: {item.step} • тест: {item.quiz_score}/{item.quiz_total} • фидбек: {item.feedback ? 'да' : 'нет'}
                        </div>
                      ))}
                      {(progressDetails?.regulations || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Нет данных.</div>}
                    </div>
                  </>
                )}
              </div>
              {selected.status === 'SENT' && (
                <div className="form-group">
                  <label className="form-label">Комментарий</label>
                  <textarea className="form-textarea" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 90 }} />
                </div>
              )}
            </div>
            {selected.status === 'SENT' && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
                <button className="btn btn-sm" style={{ background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }} onClick={() => review(selected.id, 'REVISION')}>
                  <RotateCcw size={13} /> На доработку
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => review(selected.id, 'REJECTED')}>Отклонить</button>
                <button className="btn btn-primary btn-sm" onClick={() => review(selected.id, 'ACCEPTED')}>
                  <CheckCircle size={13} /> Принять
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast toast-success"><div><div className="toast-title">Готово</div><div className="toast-msg">{toast}</div></div></div>}
    </div>
  );
}

function ViewBlock({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-700)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '10px 14px', lineHeight: 1.5 }}>
        {value || '—'}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function AdminOnboarding() {
  const [tab, setTab] = useState('programme');

  return (
    <MainLayout title="Админ-панель · Онбординг">
      <div className="page-header">
        <div className="page-title">Онбординг</div>
        <div className="page-subtitle">Управление программой адаптации и проверка отчётов стажёров</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--gray-200)' }}>
        {[['programme', 'Программа'], ['reports', 'Отчёты стажёров']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} style={{
            padding: '10px 20px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            color: tab === id ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'programme' && <ProgrammeTab />}
      {tab === 'reports' && <ReportsTab />}
    </MainLayout>
  );
}
