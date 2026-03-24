import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Flame, Star, TrendingUp, Trophy, Zap } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { gamificationAPI } from '../../api/content';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

const BADGE_META = {
  on_time_first: { icon: Star, color: '#F59E0B', bg: '#FEF3C7', label: 'Первый репорт вовремя', description: 'Отправил первый ежедневный отчёт вовремя' },
  on_time_streak_7: { icon: Zap, color: '#7C3AED', bg: '#EDE9FE', label: 'Стрик 7 дней', description: '7 рабочих дней подряд с отчётами вовремя' },
  on_time_streak_30: { icon: Trophy, color: '#D97706', bg: '#FEF3C7', label: 'Стрик 30 дней', description: '30 рабочих дней подряд с отчётами вовремя' },
};

const MILESTONES = [1, 7, 30];

function StreakCell({ dayLabel, hasMark, isToday, isWeekend }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: 10,
        background: hasMark ? 'linear-gradient(135deg, #16A34A, #22D3EE)' : isToday ? '#EFF6FF' : isWeekend ? '#F8FAFC' : '#F1F5F9',
        border: isToday ? '2px solid #2563EB' : hasMark ? '2px solid #16A34A' : '2px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        {hasMark && <CheckCircle2 size={14} style={{ color: 'white' }} />}
        {isToday && !hasMark && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB' }} />}
      </div>
      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? '#2563EB' : '#94A3B8' }}>{dayLabel}</span>
    </div>
  );
}

function BadgeCard({ badge, earned }) {
  const meta = BADGE_META[badge.code] || { icon: Award, color: '#64748B', bg: '#F1F5F9', label: badge.name, description: badge.description };
  const Icon = meta.icon;
  return (
    <div style={{
      padding: '20px',
      borderRadius: 16,
      background: earned ? meta.bg : '#F8FAFC',
      border: `2px solid ${earned ? meta.color + '40' : '#E2E8F0'}`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      opacity: earned ? 1 : 0.5,
      transition: 'all 0.2s',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: earned ? meta.color : '#CBD5E1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={22} style={{ color: 'white' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: earned ? '#1E293B' : '#94A3B8', marginBottom: 4 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          {meta.description || badge.description}
        </div>
        {earned && badge.awarded_at && (
          <div style={{ marginTop: 8, fontSize: 12, color: meta.color, fontWeight: 600 }}>
            Получен: {formatDate(badge.awarded_at)}
          </div>
        )}
        {!earned && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>Ещё не получен</div>
        )}
      </div>
    </div>
  );
}

export default function Gamification() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await gamificationAPI.my();
        setData(res.data || null);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Не удалось загрузить данные.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayIsoValue = useMemo(() => todayISO(), []);

  const weekCells = useMemo(() => {
    const monday = mondayOf(new Date());
    const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const lastReportDate = data?.last_report_date ? String(data.last_report_date).slice(0, 10) : null;
    const streak = Number(data?.current_streak || 0);
    const cells = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = isoDate(d);
      const isToday = dateStr === todayIsoValue;
      // Mark active if within streak window ending at last_report_date
      let hasMark = false;
      if (lastReportDate && streak > 0) {
        const lastDate = new Date(lastReportDate + 'T00:00:00');
        const cellDate = new Date(dateStr + 'T00:00:00');
        const diffDays = Math.round((lastDate - cellDate) / 86400000);
        hasMark = diffDays >= 0 && diffDays < streak;
      }
      cells.push({ dateStr, dayLabel: DAY_LABELS[i], isToday, hasMark, isWeekend: i >= 5 });
    }
    return cells;
  }, [data, todayIsoValue]);

  const currentStreak = Number(data?.current_streak || 0);
  const longestStreak = Number(data?.longest_streak || 0);
  const earnedBadges = safeList(data?.badges);
  const earnedCodes = new Set(earnedBadges.map((b) => b.code));

  // Progress to next milestone
  const nextMilestone = MILESTONES.find((m) => m > currentStreak) || null;
  const progressPct = nextMilestone ? Math.round((currentStreak / nextMilestone) * 100) : 100;

  // All possible badges (earned + not yet earned)
  const allBadges = MILESTONES.map((_, i) => {
    const codes = ['on_time_first', 'on_time_streak_7', 'on_time_streak_30'];
    const code = codes[i];
    const earned = earnedBadges.find((b) => b.code === code);
    return earned || { code, name: BADGE_META[code]?.label || code, description: BADGE_META[code]?.description || '', awarded_at: null };
  });

  const streakColor = currentStreak >= 30 ? '#D97706' : currentStreak >= 7 ? '#7C3AED' : currentStreak >= 1 ? '#16A34A' : '#94A3B8';

  return (
    <MainLayout title="Активность и бейджи">
      <div className="page-header">
        <div>
          <div className="page-title">Огонёк активности</div>
          <div className="page-subtitle">Твой стрик, достижения и прогресс</div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: 10, fontSize: 14 }}>{error}</div>}

      {loading && <div style={{ color: 'var(--gray-500)', padding: '32px 0', textAlign: 'center' }}>Загружаем данные...</div>}

      {!loading && !error && (
        <>
          {/* Top stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ background: `linear-gradient(135deg, ${streakColor}15, ${streakColor}08)`, border: `2px solid ${streakColor}30` }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
                <Flame size={28} style={{ color: streakColor, marginBottom: 8 }} />
                <div style={{ fontSize: 48, fontWeight: 900, color: streakColor, lineHeight: 1 }}>{currentStreak}</div>
                <div style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>дней подряд</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
                <TrendingUp size={28} style={{ color: '#2563EB', marginBottom: 8 }} />
                <div style={{ fontSize: 48, fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>{longestStreak}</div>
                <div style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>лучший результат</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
                <Award size={28} style={{ color: '#F59E0B', marginBottom: 8 }} />
                <div style={{ fontSize: 48, fontWeight: 900, color: '#F59E0B', lineHeight: 1 }}>{earnedBadges.length}</div>
                <div style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>бейджей получено</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
                <CheckCircle2 size={28} style={{ color: '#16A34A', marginBottom: 8 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginTop: 4 }}>
                  {data?.last_report_date ? formatDate(data.last_report_date) : '—'}
                </div>
                <div style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>последний отчёт</div>
              </div>
            </div>
          </div>

          {/* Week grid */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title"><Flame size={16} /> Текущая неделя</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {weekCells.map((cell) => (
                  <StreakCell key={cell.dateStr} {...cell} />
                ))}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 4, background: 'linear-gradient(135deg,#16A34A,#22D3EE)' }} /> Активный день
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 4, background: '#EFF6FF', border: '2px solid #2563EB' }} /> Сегодня
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 4, background: '#F1F5F9', border: '2px solid #E2E8F0' }} /> Нет отметки
                </span>
              </div>
            </div>
          </div>

          {/* Progress to next milestone */}
          {nextMilestone !== null && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title"><Star size={16} /> До следующего достижения</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {currentStreak} / {nextMilestone} дней
                  </span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>
                    Ещё {nextMilestone - currentStreak} {nextMilestone - currentStreak === 1 ? 'день' : nextMilestone - currentStreak < 5 ? 'дня' : 'дней'}
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 8, background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,#16A34A,#2563EB)', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: '#64748B' }}>
                  Следующий бейдж: <strong>{BADGE_META[nextMilestone === 1 ? 'on_time_first' : nextMilestone === 7 ? 'on_time_streak_7' : 'on_time_streak_30']?.label}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Award size={16} /> Коллекция бейджей</span>
              <span style={{ fontSize: 13, color: '#64748B' }}>{earnedBadges.length} / {allBadges.length} получено</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {allBadges.map((badge) => (
                  <BadgeCard key={badge.code} badge={badge} earned={earnedCodes.has(badge.code)} />
                ))}
              </div>
              {earnedBadges.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 14 }}>
                  Пока нет бейджей. Отправляй ежедневные отчёты вовремя — первый бейдж совсем близко!
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
