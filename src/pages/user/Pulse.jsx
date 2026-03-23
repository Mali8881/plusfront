import { useEffect, useState } from 'react';
import { Activity, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { pulseAPI } from '../../api/content';

const BURNOUT_META = {
  high:    { label: 'Высокий риск выгорания', color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
  medium:  { label: 'Средний риск выгорания', color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle },
  low:     { label: 'Риск низкий',             color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle  },
  unknown: { label: 'Нет данных',              color: '#94a3b8', bg: '#f8fafc', icon: Clock        },
};

const SCORE_LABELS = {
  mood:   { label: 'Настроение',    hint: '1 — очень плохое,  10 — отличное' },
  energy: { label: 'Энергия',       hint: '1 — выжат, 10 — полон сил' },
  stress: { label: 'Стресс',        hint: '1 — нет стресса, 10 — очень высокий' },
};

function ScoreBar({ value, onChange, colorFn }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: value === n ? '2px solid currentColor' : '1px solid var(--gray-200)',
            background: value >= n ? colorFn(n) : 'var(--gray-50)',
            color: value >= n ? '#fff' : 'var(--gray-500)',
            fontWeight: value === n ? 700 : 400,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {n}
        </button>
      ))}
      <span style={{ marginLeft: 4, fontWeight: 700, fontSize: 16, minWidth: 24 }}>{value ?? '—'}</span>
    </div>
  );
}

function moodColor(n)   { return n <= 3 ? '#ef4444' : n <= 6 ? '#f59e0b' : '#22c55e'; }
function energyColor(n) { return n <= 3 ? '#ef4444' : n <= 6 ? '#f59e0b' : '#22c55e'; }
function stressColor(n) { return n <= 3 ? '#22c55e' : n <= 6 ? '#f59e0b' : '#ef4444'; }

function BurnoutBadge({ level }) {
  const meta = BURNOUT_META[level] || BURNOUT_META.unknown;
  const Icon = meta.icon;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 10,
      background: meta.bg, color: meta.color,
      fontWeight: 600, fontSize: 14, border: `1px solid ${meta.color}30`,
    }}>
      <Icon size={16} />
      {meta.label}
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

function MiniChart({ history }) {
  if (!history || history.length === 0) return null;
  const items = [...history].reverse().slice(-14);
  const maxH = 60;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: maxH + 20, padding: '8px 0' }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div title={`Настроение: ${s.mood_score}`} style={{
            width: 14, height: (s.mood_score / 10) * maxH,
            background: moodColor(s.mood_score), borderRadius: 3,
          }} />
          <div style={{ fontSize: 9, color: 'var(--gray-400)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            {new Date(s.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  );
}

const CAN_SEE_TEAM = ['teamlead', 'projectmanager', 'department_head', 'admin', 'administrator', 'superadmin', 'systemadmin'];

export default function Pulse() {
  const { user } = useAuth();
  const canSeeTeam = CAN_SEE_TEAM.includes(user?.role);

  const [myData, setMyData] = useState(null);
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('my');

  const [form, setForm] = useState({ mood_score: 7, energy_score: 7, stress_score: 3, note: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [myRes, teamRes] = await Promise.all([
        pulseAPI.my(),
        canSeeTeam ? pulseAPI.team().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setMyData(myRes.data);
      setTeamData(Array.isArray(teamRes.data) ? teamRes.data : []);

      // Если уже есть опрос за сегодня — заполняем форму его значениями
      const ts = myRes.data?.today_survey;
      if (ts) {
        setForm({ mood_score: ts.mood_score, energy_score: ts.energy_score, stress_score: ts.stress_score, note: ts.note || '' });
      }
    } catch {
      setError('Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const submit = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await pulseAPI.submit(form);
      setSuccessMsg(myData?.today_submitted ? 'Опрос обновлён.' : 'Опрос отправлен.');
      await load();
    } catch {
      setError('Не удалось отправить опрос.');
    } finally {
      setSubmitting(false);
    }
  };

  const burnout = myData?.burnout || { level: 'unknown', score: null };

  return (
    <MainLayout title="Трекер настроения">
      <div style={{ maxWidth: 900, display: 'grid', gap: 20 }}>

        {/* Tabs */}
        {canSeeTeam && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ key: 'my', label: 'Мой пульс' }, { key: 'team', label: 'Команда' }].map((t) => (
              <button
                key={t.key}
                className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="card"><div className="card-body">Загрузка...</div></div>
        ) : activeTab === 'my' ? (
          <>
            {/* Burnout status */}
            <div className="card">
              <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Статус выгорания</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      По {Math.min(7, myData?.burnout?.surveys_count || 0)} последним опросам
                    </div>
                  </div>
                  <BurnoutBadge level={burnout.level} />
                </div>

                {burnout.score !== null && (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Настроение (ср.)', value: myData?.burnout?.mood_avg, color: moodColor(myData?.burnout?.mood_avg) },
                      { label: 'Энергия (ср.)',    value: myData?.burnout?.energy_avg, color: energyColor(myData?.burnout?.energy_avg) },
                      { label: 'Стресс (ср.)',     value: myData?.burnout?.stress_avg, color: stressColor(myData?.burnout?.stress_avg) },
                    ].map((stat) => (
                      <div key={stat.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="card">
              <div className="card-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {myData?.today_submitted ? 'Обновить опрос за сегодня' : 'Пройти опрос сегодня'}
                </div>
                {myData?.today_submitted && (
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    Последний опрос: {formatDate(myData?.today_survey?.timestamp)}
                  </div>
                )}

                {Object.entries(SCORE_LABELS).map(([key, meta]) => (
                  <div key={key} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{meta.hint}</span>
                    </div>
                    <ScoreBar
                      value={form[`${key}_score`]}
                      onChange={(v) => setForm((p) => ({ ...p, [`${key}_score`]: v }))}
                      colorFn={key === 'stress' ? stressColor : key === 'energy' ? energyColor : moodColor}
                    />
                  </div>
                ))}

                <div style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Заметка (необязательно)</span>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Что повлияло на ваше состояние сегодня?"
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
                {successMsg && <div style={{ color: '#22c55e', fontSize: 13 }}>{successMsg}</div>}

                <div>
                  <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                    {submitting ? 'Отправка...' : myData?.today_submitted ? 'Обновить' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>

            {/* History chart */}
            {(myData?.history?.length ?? 0) > 0 && (
              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>История настроения (последние 14 записей)</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Высота столбика — уровень настроения</div>
                  <MiniChart history={myData.history} />

                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {myData.history.slice(0, 7).map((s) => (
                      <div key={s.id} style={{
                        display: 'flex', gap: 12, alignItems: 'center',
                        padding: '8px 12px', borderRadius: 8,
                        background: 'var(--gray-50)', fontSize: 13,
                      }}>
                        <span style={{ color: 'var(--gray-400)', minWidth: 100 }}>{formatDate(s.timestamp)}</span>
                        <span>😊 <b style={{ color: moodColor(s.mood_score) }}>{s.mood_score}</b></span>
                        <span>⚡ <b style={{ color: energyColor(s.energy_score) }}>{s.energy_score}</b></span>
                        <span>🔥 <b style={{ color: stressColor(s.stress_score) }}>{s.stress_score}</b></span>
                        {s.note && <span style={{ color: 'var(--gray-600)', fontStyle: 'italic' }}>{s.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Team tab */
          <div className="card">
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Радар настроения команды</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                Сортировка: сначала сотрудники с высоким риском выгорания
              </div>

              {teamData.length === 0 ? (
                <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Нет данных о команде.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {teamData.map((m) => {
                    const meta = BURNOUT_META[m.burnout_level] || BURNOUT_META.unknown;
                    return (
                      <div key={m.user_id} style={{
                        display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
                        padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${meta.color}40`,
                        background: meta.bg,
                      }}>
                        <div style={{ minWidth: 140 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{m.full_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>@{m.username}</div>
                        </div>

                        {m.surveys_count === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--gray-400)', fontStyle: 'italic' }}>Опросов ещё нет</div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: 16 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: moodColor(m.latest_mood) }}>{m.latest_mood ?? '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Настр.</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: energyColor(m.latest_energy) }}>{m.latest_energy ?? '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Энергия</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: stressColor(m.latest_stress) }}>{m.latest_stress ?? '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Стресс</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                              {formatDate(m.latest_timestamp)} · {m.surveys_count} оп.
                            </div>
                          </>
                        )}

                        <div style={{ marginLeft: 'auto' }}>
                          <BurnoutBadge level={m.burnout_level} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
