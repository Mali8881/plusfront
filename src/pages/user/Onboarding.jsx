import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, Circle, Download, ExternalLink, Maximize2, Send, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import api from '../../api/axios';
import { onboardingAPI, regulationsAPI } from '../../api/content';

const STATUS_LABELS = {
  draft: 'Черновик',
  sent: 'Отправлен',
  accepted: 'Принят',
  rework: 'На доработке',
  rejected: 'Отклонен',
};

const normStatus = (value) => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'draft') return 'draft';
  if (raw === 'sent') return 'sent';
  if (raw === 'accepted') return 'accepted';
  if (raw === 'revision' || raw === 'rework') return 'rework';
  if (raw === 'rejected') return 'rejected';
  return 'draft';
};

const toAbsoluteMedia = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const origin = apiBase.replace(/\/api(?:\/v\d+)?\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

const findReportByDay = (reports, dayId) => reports.find((r) => String(r.day_id) === String(dayId)) || null;

function parseQuizQuestion(rawQuestion) {
  const lines = String(rawQuestion || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const options = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const question = lines.filter((line) => !/^[-*]\s+/.test(line)).join(' ').trim();
  return { question, options };
}

function formatSeconds(value) {
  const total = Math.max(0, Number(value || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Onboarding() {
  const location = useLocation();
  const [tab, setTab] = useState('onboarding');
  const [days, setDays] = useState([]);
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [activeDayId, setActiveDayId] = useState('');
  const [dayDetails, setDayDetails] = useState({});
  const [reportData, setReportData] = useState({
    did: '',
    will_do: '',
    problems: '',
    report_title: '',
    report_description: '',
    github_url: '',
    attachment: '',
  });
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [quizDrafts, setQuizDrafts] = useState({});
  const [quizStartedAt, setQuizStartedAt] = useState({});
  const [quizCooldownUntil, setQuizCooldownUntil] = useState({});
  const [quizNow, setQuizNow] = useState(Date.now());
  const [regulationPreviewStartedAt, setRegulationPreviewStartedAt] = useState({});
  const [regulationTimeSpent, setRegulationTimeSpent] = useState({});
  const [stepView, setStepView] = useState({});
  const [activeRegIndex, setActiveRegIndex] = useState(0);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [selectedRegulationBlobUrl, setSelectedRegulationBlobUrl] = useState('');
  const [reportAttachment, setReportAttachment] = useState(null);
  const [internRoleState, setInternRoleState] = useState(null);
  const [pendingRoleId, setPendingRoleId] = useState(null);
  const [busyMap, setBusyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [internSubmitStatus, setInternSubmitStatus] = useState('');
  const [internSubmitMessage, setInternSubmitMessage] = useState('');
  const [internSubmitLoading, setInternSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const activeDay = useMemo(() => days.find((d) => String(d.id) === String(activeDayId)) || null, [days, activeDayId]);
  const dayStatusById = useMemo(() => {
    const map = {};
    (overview?.days || []).forEach((item) => {
      map[String(item.day_id)] = item.status;
    });
    return map;
  }, [overview]);
  const activeDetail = activeDay ? dayDetails[String(activeDay.id)] : null;
  const activeDayStatus = activeDay ? String(dayStatusById[String(activeDay.id)] || '').toUpperCase() : '';
  const activeReport = activeDay ? findReportByDay(reports, activeDay.id) : null;
  const tasks = activeDetail?.tasks || [];
  const regulations = activeDetail?.regulations || [];
  const reportStatus = normStatus(activeReport?.status);
  const firstTask = tasks[0] || null;
  const isDayOne = Number(activeDay?.day_number) === 1;
  const isDayTwo = Number(activeDay?.day_number) === 2;
  const selectedInternRoleId = internRoleState?.selected_subdivision_id || null;
  const dayOneCompleted = !!internRoleState?.day_one_completed;
  const isActiveDayDone = activeDayStatus === 'DONE';
  const isDayOneDone = isDayOne && (dayOneCompleted || isActiveDayDone);
  const availableRoles = internRoleState?.available_subdivisions || [];
  const completedRegCount = regulations.filter((item) => item.is_read && item.has_feedback && item.has_passed_quiz).length;
  const activeRegulation = regulations[activeRegIndex] || null;
  const allRegulationsCompleted = regulations.length > 0 && completedRegCount === regulations.length;
  const mandatoryForSignature = regulations.filter((item) => item.is_mandatory_on_day_one);
  const signatureTargets = mandatoryForSignature.length > 0 ? mandatoryForSignature : regulations;
  const isSigned = signatureTargets.length > 0 && signatureTargets.every((item) => item.is_acknowledged);
  const mustSignBeforeComplete = isDayOne && allRegulationsCompleted && !isSigned;
  const canCompleteDayTwo =
    isDayTwo &&
    !!selectedInternRoleId &&
    (reportStatus === 'sent' || reportStatus === 'accepted');
  const dayFiveId = useMemo(
    () => String(days.find((d) => Number(d.day_number) === 5)?.id || ''),
    [days]
  );
  const dayFiveDone = dayFiveId ? String(dayStatusById[dayFiveId] || '').toUpperCase() === 'DONE' : false;

  const loadDayDetail = async (dayId, force = false) => {
    if (!dayId || (!force && dayDetails[String(dayId)])) return;
    const res = await onboardingAPI.getDay(dayId);
    const detail = res.data || {};
    setDayDetails((prev) => ({ ...prev, [String(dayId)]: detail }));
  };

  const extractSpecUrl = (text) => {
    const raw = String(text || '');
    const m = raw.match(/https?:\/\/[^\s]+/i);
    return m ? m[0] : '';
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [daysRes, myRes, reportsRes] = await Promise.all([
        onboardingAPI.listDays(),
        onboardingAPI.getMy(),
        onboardingAPI.getReports(),
      ]);
      const nextDays = Array.isArray(daysRes.data) ? daysRes.data : [];
      const nextReports = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setDays(nextDays);
      setOverview(myRes.data || null);
      setReports(nextReports);
      try {
        const roleRes = await onboardingAPI.getInternRole();
        setInternRoleState(roleRes.data || null);
      } catch {
        setInternRoleState(null);
      }
      try {
        const internOverviewRes = await regulationsAPI.internOverview();
        setInternSubmitStatus(String(internOverviewRes.data?.request_status || '').toLowerCase());
      } catch {
        setInternSubmitStatus('');
      }

      if (nextDays.length > 0) {
        const dayNumberParam = Number(new URLSearchParams(location.search).get('day') || 0);
        const preferredByParam = dayNumberParam
          ? nextDays.find((d) => Number(d.day_number) === dayNumberParam)?.id
          : null;
        const statusById = {};
        (myRes.data?.days || []).forEach((item) => {
          statusById[String(item.day_id)] = item.status;
        });
        const preferredIsLocked =
          preferredByParam && statusById[String(preferredByParam)] === 'LOCKED';
        const firstUnlocked = nextDays.find((d) => statusById[String(d.id)] !== 'LOCKED')?.id;
        const current =
          (!preferredIsLocked && preferredByParam) ||
          myRes.data?.current_day?.id ||
          firstUnlocked ||
          nextDays[0].id;
        setActiveDayId(String(current));
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить программу адаптации.');
    } finally {
      setLoading(false);
    }
  };

  const submitInternCompletion = async () => {
    setInternSubmitLoading(true);
    setInternSubmitMessage('');
    setError('');
    try {
      const res = await regulationsAPI.submitInternCompletion();
      setInternSubmitStatus('pending');
      setInternSubmitMessage(res.data?.message || 'Уведомление отправлено администратору.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отправить уведомление о завершении стажировки.');
    } finally {
      setInternSubmitLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [location.search]);

  useEffect(() => {
    const timer = setInterval(() => setQuizNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeDayId) return;
    setStepView({});
    setActiveRegIndex(0);
    loadDayDetail(activeDayId).catch(() => {});
  }, [activeDayId]);

  useEffect(() => {
    if (!regulations.length) {
      setActiveRegIndex(0);
      return;
    }
    const firstUnfinished = regulations.findIndex((item) => !(item.is_read && item.has_feedback && item.has_passed_quiz));
    const target = firstUnfinished === -1 ? regulations.length - 1 : firstUnfinished;
    setActiveRegIndex((prev) => {
      if (prev < 0 || prev >= regulations.length) return target;
      return prev > target ? target : prev;
    });
  }, [regulations]);

  useEffect(() => {
    if (!regulations.length) return;
    setRegulationTimeSpent((prev) => {
      let changed = false;
      const next = { ...prev };
      regulations.forEach((item) => {
        const serverSpent = Number(item.read_time_spent_seconds || 0);
        if (next[item.id] !== serverSpent) {
          next[item.id] = serverSpent;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [regulations]);

  useEffect(() => {
    if (!activeRegulation) return;
    const currentStep = stepView[activeRegulation.id] || 1;
    const timeLimit = Number(activeRegulation.quiz_time_limit_seconds || 0);
    if (currentStep === 3 && timeLimit > 0) {
      setQuizStartedAt((prev) => (
        prev[activeRegulation.id] ? prev : { ...prev, [activeRegulation.id]: Date.now() }
      ));
    }
  }, [activeRegulation?.id, activeRegulation?.quiz_time_limit_seconds, stepView]);

  useEffect(() => {
    if (!activeDay) return;
    const report = findReportByDay(reports, activeDay.id);
    setReportData({
      did: report?.did || '',
      will_do: report?.will_do || '',
      problems: report?.problems || '',
      report_title: report?.report_title || '',
      report_description: report?.report_description || '',
      github_url: report?.github_url || '',
      attachment: report?.attachment || '',
    });
    setReportAttachment(null);
  }, [activeDay, reports]);

  useEffect(() => () => {
    if (selectedRegulationBlobUrl) {
      window.URL.revokeObjectURL(selectedRegulationBlobUrl);
    }
  }, [selectedRegulationBlobUrl]);

  const markBusy = (key, value) => {
    setBusyMap((prev) => ({ ...prev, [key]: value }));
  };

  const getRegulationTimeSpentSeconds = (regulationId, nowValue = Date.now()) => {
    const baseSeconds = Number(regulationTimeSpent[regulationId] || 0);
    const startedAt = regulationPreviewStartedAt[regulationId];
    if (!startedAt) return baseSeconds;
    return baseSeconds + Math.max(0, Math.floor((nowValue - startedAt) / 1000));
  };

  const startRegulationPreviewTimer = (regulationId, nowValue = Date.now()) => {
    if (!regulationId) return;
    setRegulationPreviewStartedAt((prev) => (
      prev[regulationId] ? prev : { ...prev, [regulationId]: nowValue }
    ));
  };

  const stopRegulationPreviewTimer = (regulationId, nowValue = Date.now()) => {
    if (!regulationId) return 0;
    const totalSeconds = getRegulationTimeSpentSeconds(regulationId, nowValue);
    setRegulationTimeSpent((prev) => ({ ...prev, [regulationId]: totalSeconds }));
    setRegulationPreviewStartedAt((prev) => {
      if (!prev[regulationId]) return prev;
      const next = { ...prev };
      delete next[regulationId];
      return next;
    });
    return totalSeconds;
  };

  const closeRegulationModal = () => {
    stopRegulationPreviewTimer(selectedRegulation?.id, Date.now());
    setSelectedRegulation(null);
    if (selectedRegulationBlobUrl) {
      window.URL.revokeObjectURL(selectedRegulationBlobUrl);
      setSelectedRegulationBlobUrl('');
    }
  };

  const completeCurrentDay = async () => {
    if (!activeDay) return;
    setSubmitting(true);
    setError('');
    try {
      await onboardingAPI.completeDay(activeDay.id);
      await load();
      await loadDayDetail(activeDay.id, true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось завершить день адаптации.');
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledgeRegulations = async () => {
    if (!activeDay || !signatureTargets.length) return;
    markBusy('acknowledge-day1', true);
    setError('');
    try {
      const pending = signatureTargets.filter((item) => !item.is_acknowledged);
      await Promise.all(pending.map((item) => regulationsAPI.acknowledge(item.id)));
      await loadDayDetail(activeDay.id, true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось подтвердить подпись регламентов.');
    } finally {
      markBusy('acknowledge-day1', false);
    }
  };

  const chooseInternRole = async (subdivisionId) => {
    if (!subdivisionId) return;
    setRoleSubmitting(true);
    setError('');
    try {
      await onboardingAPI.setInternRole(subdivisionId);
      const roleRes = await onboardingAPI.getInternRole();
      setInternRoleState(roleRes.data || null);
      if (activeDayId) {
        await loadDayDetail(activeDayId, true);
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось выбрать роль.');
    } finally {
      setRoleSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!activeDay) return;
    if (isDayTwo) {
      if (!reportData.report_title.trim() || !reportData.report_description.trim() || !reportData.github_url.trim()) {
        setError('Для 2-го дня заполните название, описание и ссылку на GitHub.');
        return;
      }
      if (!reportData.github_url.includes('github.com')) {
        setError('Ссылка должна вести на GitHub.');
        return;
      }
    } else if (!reportData.did.trim() || !reportData.will_do.trim()) {
      setError('Заполните поля "Что сделал" и "Что буду делать".');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = new FormData();
      payload.append('day_id', activeDay.id);
      payload.append('did', reportData.did || '');
      payload.append('will_do', reportData.will_do || '');
      payload.append('problems', reportData.problems || '');
      payload.append('report_title', reportData.report_title || '');
      payload.append('report_description', reportData.report_description || '');
      payload.append('github_url', reportData.github_url || '');
      if (reportAttachment) {
        payload.append('attachment', reportAttachment);
      }
      if (activeReport?.id) {
        await onboardingAPI.updateReport(activeReport.id, payload);
      } else {
        await onboardingAPI.submitReport(payload);
      }
      const reportsRes = await onboardingAPI.getReports();
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      const myRes = await onboardingAPI.getMy();
      setOverview(myRes.data || null);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отправить отчет.');
    } finally {
      setSubmitting(false);
    }
  };

  const markRegulationRead = async (regulation) => {
    const regulationId = regulation?.id;
    if (!regulationId) return;
    const minReadSeconds = Number(regulation?.min_read_seconds || 45);
    const timeSpent = getRegulationTimeSpentSeconds(regulationId, Date.now());
    if (timeSpent < minReadSeconds) {
      setError(`Проведите с регламентом не менее ${minReadSeconds} секунд. Сейчас: ${formatSeconds(timeSpent)}.`);
      return;
    }

    markBusy(`read-${regulationId}`, true);
    setError('');
    try {
      await regulationsAPI.markRead(regulationId, { time_spent: timeSpent });
      setRegulationTimeSpent((prev) => ({ ...prev, [regulationId]: timeSpent }));
      await loadDayDetail(activeDayId, true);
    } catch (e) {
      setError(e.response?.data?.time_spent?.[0] || e.response?.data?.detail || 'Не удалось отметить регламент как прочитанный.');
    } finally {
      markBusy(`read-${regulationId}`, false);
    }
  };

  const submitRegulationFeedback = async (regulationId) => {
    const text = String(feedbackDrafts[regulationId] || '').trim();
    if (!text) {
      setError('Введите фидбек по регламенту.');
      return;
    }

    markBusy(`feedback-${regulationId}`, true);
    setError('');
    try {
      await regulationsAPI.sendFeedback(regulationId, { text });
      setFeedbackDrafts((prev) => ({ ...prev, [regulationId]: '' }));
      await loadDayDetail(activeDayId, true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отправить фидбек по регламенту.');
    } finally {
      markBusy(`feedback-${regulationId}`, false);
    }
  };

  const submitRegulationQuiz = async (regulation) => {
    const regulationId = regulation?.id;
    if (!regulationId) return;
    const quizQuestions = Array.isArray(regulation.quiz_questions) ? regulation.quiz_questions : [];
    const draft = quizDrafts[regulationId];
    const answers = quizQuestions.length > 0
      ? quizQuestions.map((_, idx) => String(draft?.[idx] || '').trim())
      : [];
    const answer = quizQuestions.length > 0 ? '' : String(draft || '').trim();
    if (quizQuestions.length > 0 && answers.some((item) => !item)) {
      setError('Ответьте на все вопросы теста.');
      return;
    }
    if (quizQuestions.length === 0 && !answer) {
      setError('Введите ответ на вопрос по регламенту.');
      return;
    }

    const timeLimitSeconds = Number(regulation.quiz_time_limit_seconds || 0);
    const now = Date.now();
    const existingStartedAt = quizStartedAt[regulationId];
    const startedAtValue = timeLimitSeconds > 0 ? (existingStartedAt || now) : null;
    if (timeLimitSeconds > 0) {
      if (!existingStartedAt) {
        setQuizStartedAt((prev) => ({ ...prev, [regulationId]: startedAtValue }));
      }
      const elapsed = Math.floor((now - startedAtValue) / 1000);
      if (elapsed > timeLimitSeconds) {
        setError('Время на тест истекло. Откройте тест заново.');
        setQuizStartedAt((prev) => {
          const next = { ...prev };
          delete next[regulationId];
          return next;
        });
        return;
      }
    }

    const cooldownUntil = quizCooldownUntil[regulationId];
    if (cooldownUntil && cooldownUntil > now) {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
      setError(`Повторная попытка будет доступна через ${formatSeconds(remaining)}.`);
      return;
    }

    markBusy(`quiz-${regulationId}`, true);
    setError('');
    try {
      const basePayload = quizQuestions.length > 0 ? { answers } : { answer };
      const payload = startedAtValue ? { ...basePayload, started_at: new Date(startedAtValue).toISOString() } : basePayload;
      const res = await regulationsAPI.submitQuiz(regulationId, payload);
      if (!res.data?.is_passed) {
        setError(res.data?.detail || 'Ответ не принят. Попробуйте еще раз.');
        setQuizStartedAt((prev) => {
          const next = { ...prev };
          delete next[regulationId];
          return next;
        });
        if (res.data?.restart_required) {
          setStepView((prev) => ({ ...prev, [regulationId]: 1 }));
        }
      } else {
        setQuizDrafts((prev) => ({ ...prev, [regulationId]: quizQuestions.length > 0 ? {} : '' }));
        setQuizStartedAt((prev) => {
          const next = { ...prev };
          delete next[regulationId];
          return next;
        });
        setQuizCooldownUntil((prev) => {
          const next = { ...prev };
          delete next[regulationId];
          return next;
        });
      }
      await loadDayDetail(activeDayId, true);
    } catch (e) {
      const status = e.response?.status;
      const retryAtRaw = e.response?.data?.retry_at;
      if (status === 429 && retryAtRaw) {
        const retryAt = new Date(retryAtRaw).getTime();
        if (Number.isFinite(retryAt)) {
          setQuizCooldownUntil((prev) => ({ ...prev, [regulationId]: retryAt }));
          const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
          setError(`Повторная попытка будет доступна через ${formatSeconds(remaining)}.`);
          return;
        }
      }
      if (String(e.response?.data?.detail || '').toLowerCase().includes('time limit')) {
        setError('Время на тест истекло. Откройте тест заново.');
        setQuizStartedAt((prev) => {
          const next = { ...prev };
          delete next[regulationId];
          return next;
        });
        return;
      }
      setError(e.response?.data?.detail || 'Не удалось отправить тест по регламенту.');
    } finally {
      markBusy(`quiz-${regulationId}`, false);
    }
  };
  const openRegulationPreview = async (regulation) => {
    if (!regulation) return;
    if (selectedRegulation?.id && selectedRegulation.id !== regulation.id) {
      stopRegulationPreviewTimer(selectedRegulation.id, Date.now());
    }
    if (regulation.type === 'link' && regulation.content) {
      setSelectedRegulationBlobUrl('');
      setSelectedRegulation(regulation);
      startRegulationPreviewTimer(regulation.id, Date.now());
      return;
    }
    markBusy(`preview-${regulation.id}`, true);
    setError('');
    try {
      const res = await api.get(`/v1/regulations/${regulation.id}/view/`, {
        responseType: 'blob',
      });
      if (selectedRegulationBlobUrl) {
        window.URL.revokeObjectURL(selectedRegulationBlobUrl);
      }
      const blobUrl = window.URL.createObjectURL(res.data);
      setSelectedRegulationBlobUrl(blobUrl);
      setSelectedRegulation(regulation);
      startRegulationPreviewTimer(regulation.id, Date.now());
    } catch {
      setError('Не удалось открыть регламент. Попробуйте скачать файл.');
    } finally {
      markBusy(`preview-${regulation.id}`, false);
    }
  };

  const downloadRegulation = async (regulation) => {
    markBusy(`download-${regulation.id}`, true);
    setError('');
    try {
      const res = await api.get(`/v1/regulations/${regulation.id}/download/`, {
        responseType: 'blob',
      });
      const blob = res.data;
      const blobUrl = window.URL.createObjectURL(blob);
      const ext = (() => {
        const clean = String(regulation.content || '').split('?')[0].toLowerCase();
        if (clean.endsWith('.pdf')) return '.pdf';
        if (clean.endsWith('.docx')) return '.docx';
        if (clean.endsWith('.doc')) return '.doc';
        return '';
      })();
      const filename = `${regulation.title || 'regulation'}${ext}`.replace(/[\\/:*?"<>|]+/g, '_');
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Не удалось скачать файл. Проверьте авторизацию и попробуйте снова.');
    } finally {
      markBusy(`download-${regulation.id}`, false);
    }
  };

  return (
    <MainLayout title="Программа адаптации">
      <div className="page-header">
        <div>
          <div className="page-title">Программа адаптации</div>
          <div className="page-subtitle">Материалы, задачи и ежедневный отчет стажера</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#b91c1c' }}>{error}</div>
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="card-body">Загрузка...</div>
        </div>
      )}

      {!loading && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {days.map((day) => {
              const status = dayStatusById[String(day.id)] || 'IN_PROGRESS';
              const done = status === 'DONE';
              const locked = status === 'LOCKED';
              return (
                <button
                  key={day.id}
                  onClick={() => {
                    if (!locked) setActiveDayId(String(day.id));
                  }}
                  disabled={locked}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid',
                    borderColor: String(activeDayId) === String(day.id) ? 'var(--primary)' : 'var(--gray-200)',
                    background: locked
                      ? 'var(--gray-100)'
                      : String(activeDayId) === String(day.id)
                        ? 'var(--primary-light)'
                        : 'white',
                    color: locked
                      ? 'var(--gray-400)'
                      : String(activeDayId) === String(day.id)
                        ? 'var(--primary)'
                        : 'var(--gray-700)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: locked ? 0.8 : 1,
                  }}
                >
                  День {day.day_number}
                  {done && <CheckCircle size={13} color="#16A34A" />}
                  {locked && <span style={{ fontSize: 11 }}>закрыт</span>}
                </button>
              );
            })}
          </div>

          <div className="tabs">
            <button className={`tab-btn ${tab === 'onboarding' ? 'active' : ''}`} onClick={() => setTab('onboarding')}>Онбординг</button>
            <button className={`tab-btn ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Задачи</button>
            <button className={`tab-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>Отчет</button>
          </div>

          {dayFiveDone && (
            <div className="card" style={{ marginBottom: 14, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
              <div className="card-body" style={{ padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                  Завершение стажировки
                </div>
                <div style={{ fontSize: 13, color: '#1e3a8a', marginBottom: 10 }}>
                  После завершения 5-го дня отправьте уведомление администратору для подтверждения перевода в сотрудника.
                </div>
                {internSubmitStatus === 'pending' && (
                  <div style={{ fontSize: 13, color: '#854d0e', marginBottom: 8 }}>
                    Заявка уже отправлена и ожидает подтверждения.
                  </div>
                )}
                {internSubmitStatus === 'approved' && (
                  <div style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>
                    Заявка подтверждена. Стажировка завершена.
                  </div>
                )}
                {internSubmitStatus === 'rejected' && (
                  <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 8 }}>
                    Предыдущая заявка была отклонена. Вы можете отправить повторно.
                  </div>
                )}
                {!['pending', 'approved'].includes(internSubmitStatus) && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={submitInternCompletion}
                    disabled={internSubmitLoading}
                  >
                    {internSubmitLoading ? 'Отправляем...' : 'Отправить уведомление об окончании стажировки'}
                  </button>
                )}
                {!!internSubmitMessage && (
                  <div style={{ fontSize: 13, color: '#166534', marginTop: 8 }}>{internSubmitMessage}</div>
                )}
              </div>
            </div>
          )}

          {tab === 'onboarding' && activeDay && (
            <div className="onboarding-day-card">
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                День {activeDay.day_number}. {activeDay.title}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
                Дедлайн: {activeDay.deadline_time || 'Не задан'}
              </div>

              {isDayTwo && (
                <div className="card" style={{ marginBottom: 16, border: '1px solid var(--gray-200)' }}>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Выбор роли на 2-й день</div>
                    {!dayOneCompleted && (
                      <div style={{ color: '#991b1b', fontSize: 13 }}>
                        Роль можно выбрать только после завершения 1-го дня.
                      </div>
                    )}
                    {dayOneCompleted && (
                      <>
                        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10 }}>
                          Выберите подотдел/роль. От этого зависит ваша задача на 2-й день.
                        </div>
                        {availableRoles.length === 0 && (
                          <div style={{ fontSize: 13, color: '#b45309', marginBottom: 10 }}>
                            Нет доступных ролей для выбора. Обратитесь к администратору: нужно добавить подотделы в вашем отделе.
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {availableRoles.map((item) => (
                            <button
                              key={item.id}
                              className={String((pendingRoleId ?? selectedInternRoleId) || '') === String(item.id) ? 'btn btn-primary' : 'btn btn-secondary'}
                              onClick={() => setPendingRoleId(item.id)}
                              disabled={roleSubmitting || !!selectedInternRoleId}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                        {!selectedInternRoleId && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              className="btn btn-primary"
                              onClick={() => chooseInternRole(pendingRoleId)}
                              disabled={roleSubmitting || !pendingRoleId}
                            >
                              {roleSubmitting ? 'Подтверждаем...' : 'Подтвердить роль'}
                            </button>
                          </div>
                        )}
                        {!!selectedInternRoleId && (
                          <div style={{ marginTop: 10, fontSize: 13, color: '#166534' }}>
                            Роль подтверждена: {internRoleState?.selected_subdivision_name}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {isDayOne && (
                <div className="card" style={{ marginBottom: 16, border: '1px solid var(--gray-200)' }}>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Задача Дня 1</div>
                    <div style={{ fontSize: 14, color: 'var(--gray-700)', marginBottom: 10 }}>
                      Прочитать все регламенты, затем по каждому отправить фидбек и пройти тест.
                    </div>
                    {firstTask?.due_date && (
                      <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>
                        Дедлайн задачи: {firstTask.due_date}
                      </div>
                    )}
                    <button
                      className={`btn ${isDayOneDone ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => setTab('tasks')}
                      disabled={isDayOneDone}
                    >
                      Открыть задачу
                    </button>
                  </div>
                </div>
              )}

              <div style={{ color: 'var(--gray-600)', marginBottom: 20 }}>
                Регламенты и шаги выполнения находятся во вкладке <b>Задачи</b>.
              </div>

              {isDayOne && !allRegulationsCompleted && (
                <div className="card" style={{ marginBottom: 12, border: '1px solid #fecaca', background: '#fef2f2' }}>
                  <div className="card-body" style={{ padding: 14, color: '#991b1b' }}>
                    Сначала завершите все шаги по регламентам (прочитан, фидбек, тест), потом можно будет подписать и завершить 1-й день.
                  </div>
                </div>
              )}

              {mustSignBeforeComplete && (
                <div className="card" style={{ marginBottom: 12, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
                  <div className="card-body" style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, color: '#1e3a8a', marginBottom: 10 }}>
                      Вы завершили ознакомление с регламентами. Подойдите к Жибек и подпишите, что ознакомлены с регламентами.
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={acknowledgeRegulations}
                      disabled={!!busyMap['acknowledge-day1']}
                    >
                      {busyMap['acknowledge-day1'] ? 'Сохраняем...' : 'Подписал'}
                    </button>
                  </div>
                </div>
              )}

              {!isDayTwo && isDayOneDone && (
                <button className="btn btn-secondary" disabled type="button">
                  Первый день адаптации завершен
                </button>
              )}
              {(!isDayOne || (allRegulationsCompleted && isSigned)) && !isDayTwo && !isDayOneDone && (
                <button className="btn btn-primary" disabled={submitting} onClick={completeCurrentDay}>
                  {isDayOne ? 'Закончить первый день адаптации' : 'Завершить день адаптации'}
                </button>
              )}

              {isDayTwo && !canCompleteDayTwo && (
                <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                  Для завершения 2-го дня выберите роль и отправьте отчет во вкладке "Отчет".
                </div>
              )}
              {isDayTwo && canCompleteDayTwo && (
                <button className="btn btn-primary" disabled={submitting} onClick={completeCurrentDay}>
                  Завершить 2-й день
                </button>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="onboarding-day-card">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Задачи дня</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{activeDay?.title || ''}</div>
              </div>

              {tasks.length === 0 && <div style={{ color: 'var(--gray-500)' }}>Задачи не назначены.</div>}
              {tasks.map((task) => (
                <div key={task.id} className="card" style={{ marginBottom: 10 }}>
                  <div className="card-body" style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4, whiteSpace: 'pre-line' }}>
                        {task.description}
                      </div>
                    )}
                    {task.due_date && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>Дедлайн: {task.due_date}</div>}
                    {extractSpecUrl(task.description) && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => window.open(extractSpecUrl(task.description), '_blank', 'noopener,noreferrer')}
                        >
                          Открыть ТЗ
                        </button>
                        <a
                          className="btn btn-secondary"
                          href={extractSpecUrl(task.description)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Скачать
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isDayOne && (
                <div className="card" style={{ marginTop: 14 }}>
                  <div className="card-body" style={{ padding: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                      Шаги по регламентам
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {regulations.length === 0 && <div style={{ color: 'var(--gray-500)' }}>На этот день регламенты не назначены.</div>}
                      {regulations.length > 0 && (
                        <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                          Прогресс по регламентам: {completedRegCount}/{regulations.length}
                        </div>
                      )}
                      {activeRegulation && (() => {
                        const regulation = activeRegulation;
                        const index = activeRegIndex;
                        const regulationUrl = toAbsoluteMedia(regulation.content);
                        const isRead = !!regulation.is_read;
                        const hasFeedback = !!regulation.has_feedback;
                        const requiresQuiz = regulation.requires_quiz !== false;
                        const hasPassedQuiz = !!regulation.has_passed_quiz;
                        const { question: parsedQuizQuestion, options: quizOptions } = parseQuizQuestion(regulation.quiz_question);
                        const quizQuestions = Array.isArray(regulation.quiz_questions) ? regulation.quiz_questions : [];
                        const timeLimitSeconds = Number(regulation.quiz_time_limit_seconds || 0);
                        const startedAt = quizStartedAt[regulation.id];
                        const elapsedSeconds = startedAt ? Math.floor((quizNow - startedAt) / 1000) : 0;
                        const remainingSeconds = timeLimitSeconds > 0 ? Math.max(0, timeLimitSeconds - elapsedSeconds) : null;
                        const isTimeExpired = timeLimitSeconds > 0 && startedAt && remainingSeconds <= 0;
                        const cooldownUntil = quizCooldownUntil[regulation.id];
                        const cooldownRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - quizNow) / 1000)) : 0;
                        const isCooldownActive = cooldownUntil && cooldownUntil > quizNow;
                        const currentStep = stepView[regulation.id] || 1;
                        const previousRegulationsDone = index === 0 || regulations
                          .slice(0, index)
                          .every((item) => item.is_read && item.has_feedback && item.has_passed_quiz);
                        const minReadSeconds = Number(regulation.min_read_seconds || 45);
                        const currentReadSeconds = getRegulationTimeSpentSeconds(regulation.id, quizNow);
                        const readSecondsLeft = Math.max(0, minReadSeconds - currentReadSeconds);
                        const hasVersionUpdate = !!(regulation.requires_reread || regulation.requires_reacknowledgement);
                        const canDoStep1 = previousRegulationsDone;
                        const canDoStep2 = previousRegulationsDone && isRead;
                        const canDoStep3 = previousRegulationsDone && hasFeedback && requiresQuiz;
                        const canAttemptQuiz = canDoStep3 && !hasPassedQuiz && !isCooldownActive && !isTimeExpired;
                        const goToStep = (step) => setStepView((prev) => ({ ...prev, [regulation.id]: step }));
                        return (
                          <div
                            key={regulation.id}
                            style={{
                              border: '1px solid var(--gray-200)',
                              borderRadius: 8,
                              padding: 12,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>Шаг {index + 1}: {regulation.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                                  Версия {regulation.version}
                                  {regulation.read_version ? ` • вы читали v${regulation.read_version}` : ' • еще не прочитан'}
                                  {regulation.acknowledged_version ? ` • подпись v${regulation.acknowledged_version}` : ''}
                                </div>
                              </div>
                              {regulationUrl ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    className="btn btn-outline"
                                    onClick={() => openRegulationPreview(regulation)}
                                    disabled={!!busyMap[`preview-${regulation.id}`]}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <ExternalLink size={14} /> {busyMap[`preview-${regulation.id}`] ? 'Открываем...' : 'Подробнее'}
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => downloadRegulation(regulation)}
                                    disabled={!!busyMap[`download-${regulation.id}`]}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <Download size={14} /> Скачать
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                              {hasVersionUpdate && (
                                <div
                                  style={{
                                    border: '1px solid #bfdbfe',
                                    background: '#eff6ff',
                                    color: '#1e3a8a',
                                    borderRadius: 8,
                                    padding: 10,
                                    fontSize: 13,
                                  }}
                                >
                                  Для этого регламента вышла новая версия. Нужно заново прочитать документ
                                  {regulation.requires_reacknowledgement ? ' и повторно подтвердить ознакомление.' : '.'}
                                </div>
                              )}
                              {String(regulation.change_log || '').trim() && (
                                <div
                                  style={{
                                    border: '1px solid var(--gray-200)',
                                    background: 'var(--gray-50)',
                                    borderRadius: 8,
                                    padding: 10,
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Что изменилось в версии {regulation.version}</div>
                                  <div style={{ fontSize: 13, color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
                                    {regulation.change_log}
                                  </div>
                                </div>
                              )}
                              {!previousRegulationsDone && (
                                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                  Этот регламент откроется после полного завершения предыдущего.
                                </div>
                              )}
                              {currentStep === 1 && (
                                <div className="card" style={{ border: '1px solid var(--gray-200)' }}>
                                  <div className="card-body" style={{ padding: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Шаг 1. Отметить, что прочитано</div>
                                    <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10 }}>
                                      Откройте регламент через кнопку <b>Подробнее</b>, проведите в документе не меньше {minReadSeconds} секунд, затем отметьте как прочитано.
                                    </div>
                                    <div style={{ fontSize: 12, color: readSecondsLeft > 0 ? 'var(--gray-600)' : '#15803d', marginBottom: 10 }}>
                                      Ознакомление: <b>{formatSeconds(currentReadSeconds)}</b> из {formatSeconds(minReadSeconds)}
                                      {readSecondsLeft > 0 ? ` • осталось ${formatSeconds(readSecondsLeft)}` : ' • можно подтверждать'}
                                    </div>
                                    <button
                                      className="btn btn-secondary"
                                      disabled={!canDoStep1 || isRead || readSecondsLeft > 0 || !!busyMap[`read-${regulation.id}`]}
                                      onClick={() => markRegulationRead(regulation)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                    >
                                      {isRead ? 'Прочитано' : readSecondsLeft > 0 ? 'Недостаточно времени' : 'Отметить как прочитано'}
                                    </button>
                                    {isRead && (
                                      <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => goToStep(2)}>
                                        Дальше
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {currentStep === 2 && (
                                <div className="card" style={{ border: '1px solid var(--gray-200)' }}>
                                  <div className="card-body" style={{ padding: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Шаг 2. Фидбек по регламенту</div>
                                    <textarea
                                      className="form-textarea"
                                      placeholder="Коротко напишите, что было не непонятно, если все понятно так и напишите"
                                      value={feedbackDrafts[regulation.id] || ''}
                                      onChange={(e) => setFeedbackDrafts((prev) => ({ ...prev, [regulation.id]: e.target.value }))}
                                      disabled={!canDoStep2 || hasFeedback}
                                      style={{ minHeight: 82, marginBottom: 8 }}
                                    />
                                    <button
                                      className="btn btn-secondary"
                                      disabled={!canDoStep2 || hasFeedback || !!busyMap[`feedback-${regulation.id}`]}
                                      onClick={() => submitRegulationFeedback(regulation.id)}
                                    >
                                      {hasFeedback ? 'Фидбек отправлен' : 'Отправить фидбек'}
                                    </button>
                                    {hasFeedback && requiresQuiz && (
                                      <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => goToStep(requiresQuiz ? 3 : 2)}>
                                        Дальше
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {requiresQuiz && currentStep === 3 && (
                                <div className="card" style={{ border: '1px solid var(--gray-200)' }}>
                                  <div className="card-body" style={{ padding: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Шаг 3. Тест на знание</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                                      {timeLimitSeconds > 0 && (
                                        <div style={{ fontSize: 12, color: isTimeExpired ? '#b91c1c' : 'var(--gray-600)' }}>
                                          Таймер: <b>{formatSeconds(remainingSeconds)}</b>
                                          <span style={{ marginLeft: 6, color: 'var(--gray-500)' }}>Лимит: {formatSeconds(timeLimitSeconds)}</span>
                                        </div>
                                      )}
                                      {isCooldownActive && (
                                        <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                                          Повторная попытка будет доступна через {formatSeconds(cooldownRemaining)}.
                                        </div>
                                      )}
                                      {isTimeExpired && (
                                        <div style={{ fontSize: 12, color: '#b91c1c' }}>
                                          Время на тест истекло. Откройте тест заново.
                                        </div>
                                      )}
                                    </div>
                                    {quizQuestions.length > 0 ? (
                                      <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                                        {quizQuestions.map((item, qIndex) => (
                                          <div key={`${regulation.id}-q-${qIndex}`} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8 }}>
                                            <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 6 }}>
                                              {qIndex + 1}. {item.question}
                                            </div>
                                            <div style={{ display: 'grid', gap: 6 }}>
                                              {(item.options || []).map((opt) => (
                                                <label key={`${regulation.id}-${qIndex}-${opt}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                  <input
                                                    type="radio"
                                                    name={`quiz-${regulation.id}-${qIndex}`}
                                                    checked={String(quizDrafts[regulation.id]?.[qIndex] || '') === String(opt)}
                                                    onChange={() =>
                                                      setQuizDrafts((prev) => ({
                                                        ...prev,
                                                        [regulation.id]: { ...(prev[regulation.id] || {}), [qIndex]: opt },
                                                      }))
                                                    }
                                                    disabled={!canAttemptQuiz}
                                                  />
                                                  <span style={{ fontSize: 13 }}>{opt}</span>
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : quizOptions.length >= 2 ? (
                                      <>
                                        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 6 }}>
                                          {parsedQuizQuestion || 'Подтвердите знание регламента в свободной форме.'}
                                        </div>
                                      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                                        {quizOptions.map((opt) => (
                                          <label key={`${regulation.id}-${opt}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                              type="radio"
                                              name={`quiz-${regulation.id}`}
                                              checked={String(quizDrafts[regulation.id] || '') === String(opt)}
                                              onChange={() => setQuizDrafts((prev) => ({ ...prev, [regulation.id]: opt }))}
                                              disabled={!canAttemptQuiz}
                                            />
                                            <span style={{ fontSize: 13 }}>{opt}</span>
                                          </label>
                                        ))}
                                      </div>
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 6 }}>
                                          {parsedQuizQuestion || 'Подтвердите знание регламента в свободной форме.'}
                                        </div>
                                        <input
                                          className="form-input"
                                          placeholder="Введите ответ"
                                          value={quizDrafts[regulation.id] || ''}
                                          onChange={(e) => setQuizDrafts((prev) => ({ ...prev, [regulation.id]: e.target.value }))}
                                          disabled={!canAttemptQuiz}
                                          style={{ marginBottom: 8 }}
                                        />
                                      </>
                                    )}
                                    <button
                                      className="btn btn-secondary"
                                      disabled={!canAttemptQuiz || !!busyMap[`quiz-${regulation.id}`]}
                                      onClick={() => submitRegulationQuiz(regulation)}
                                    >
                                      {hasPassedQuiz ? 'Тест пройден' : isTimeExpired ? 'Время истекло' : isCooldownActive ? 'Ожидание' : 'Отправить ответ'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', gap: 10, fontSize: 13 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {isRead ? <CheckCircle size={14} color="#16A34A" /> : <Circle size={14} color="#9CA3AF" />} Прочитан
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {hasFeedback ? <CheckCircle size={14} color="#16A34A" /> : <Circle size={14} color="#9CA3AF" />} Фидбек
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {hasPassedQuiz ? <CheckCircle size={14} color="#16A34A" /> : <Circle size={14} color="#9CA3AF" />} {requiresQuiz ? 'Тест' : 'Без теста'}
                              </span>
                            </div>

                            {isRead && hasFeedback && hasPassedQuiz && index < regulations.length - 1 && (
                              <div style={{ marginTop: 12 }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setActiveRegIndex(index + 1);
                                    const next = regulations[index + 1];
                                    if (next) {
                                      setStepView((prev) => ({ ...prev, [next.id]: prev[next.id] || 1 }));
                                    }
                                  }}
                                >
                                  Следующий регламент
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {isDayOne && allRegulationsCompleted && (
                <div className="card" style={{ marginTop: 14, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
                  <div className="card-body" style={{ padding: 14 }}>
                    {!isSigned ? (
                      <>
                        <div style={{ fontSize: 14, color: '#1e3a8a', marginBottom: 10 }}>
                          Вы завершили все 10 шагов. Подойдите к Жибек и подпишите, что ознакомлены с регламентами.
                        </div>
                        <button
                          className={`btn ${isDayOneDone ? 'btn-secondary' : 'btn-primary'}`}
                          type="button"
                          onClick={acknowledgeRegulations}
                          disabled={isDayOneDone || !!busyMap['acknowledge-day1']}
                        >
                          {busyMap['acknowledge-day1'] ? 'Сохраняем...' : 'Подписал'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: '#1e3a8a', marginBottom: 10 }}>
                          Подпись подтверждена. Подтвердите окончание первого дня адаптации.
                        </div>
                        <button
                          className={`btn ${isDayOneDone ? 'btn-secondary' : 'btn-primary'}`}
                          type="button"
                          onClick={completeCurrentDay}
                          disabled={isDayOneDone || submitting}
                        >
                          {isDayOneDone ? 'Первый день завершен' : submitting ? 'Сохраняем...' : 'Подтвердить окончание дня'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'report' && (
            <div className="onboarding-day-card">
              <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--gray-500)' }}>
                Статус: {STATUS_LABELS[reportStatus]}
              </div>

              {isDayTwo ? (
                <>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Название работы</label>
                    <input
                      className="form-input"
                      value={reportData.report_title}
                      onChange={(e) => setReportData((prev) => ({ ...prev, report_title: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Описание</label>
                    <textarea
                      className="form-textarea"
                      value={reportData.report_description}
                      onChange={(e) => setReportData((prev) => ({ ...prev, report_description: e.target.value }))}
                      style={{ minHeight: 120 }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Ссылка на GitHub</label>
                    <input
                      className="form-input"
                      value={reportData.github_url}
                      onChange={(e) => setReportData((prev) => ({ ...prev, github_url: e.target.value }))}
                      placeholder="https://github.com/..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Что сделал</label>
                    <textarea
                      className="form-textarea"
                      value={reportData.did}
                      onChange={(e) => setReportData((prev) => ({ ...prev, did: e.target.value }))}
                      style={{ minHeight: 120 }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Что буду делать</label>
                    <textarea
                      className="form-textarea"
                      value={reportData.will_do}
                      onChange={(e) => setReportData((prev) => ({ ...prev, will_do: e.target.value }))}
                      style={{ minHeight: 120 }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Проблемы</label>
                    <textarea
                      className="form-textarea"
                      value={reportData.problems}
                      onChange={(e) => setReportData((prev) => ({ ...prev, problems: e.target.value }))}
                      style={{ minHeight: 100 }}
                    />
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Вложение (необязательно)</label>
                <input
                  className="form-input"
                  type="file"
                  onChange={(e) => setReportAttachment(e.target.files?.[0] || null)}
                />
                {reportData.attachment ? (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Текущее вложение: <a href={toAbsoluteMedia(reportData.attachment)} target="_blank" rel="noreferrer">Открыть файл</a>
                  </div>
                ) : null}
              </div>

              <button
                className="btn btn-primary"
                disabled={submitting || (isDayTwo && !selectedInternRoleId)}
                onClick={submitReport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={14} /> {submitting ? 'Отправка...' : 'Сохранить отчет'}
              </button>
            </div>
          )}

          {selectedRegulation && (
            <div className="modal-overlay" onClick={closeRegulationModal}>
              <div className="modal" style={{ width: 'calc(100vw - 24px)', height: 'calc(100vh - 24px)', maxWidth: 'unset', maxHeight: 'unset' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <div className="modal-title">{selectedRegulation.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                      Версия {selectedRegulation.version} • время ознакомления: {formatSeconds(getRegulationTimeSpentSeconds(selectedRegulation.id, quizNow))}
                    </div>
                  </div>
                  <button className="btn-icon" type="button" onClick={closeRegulationModal}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  {String(selectedRegulation.change_log || '').trim() && (
                    <div
                      style={{
                        marginBottom: 12,
                        border: '1px solid var(--gray-200)',
                        background: 'var(--gray-50)',
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Изменения в версии {selectedRegulation.version}</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
                        {selectedRegulation.change_log}
                      </div>
                    </div>
                  )}
                  {(selectedRegulation.type === 'link' && selectedRegulation.content) || selectedRegulationBlobUrl ? (
                    <iframe
                      title={`regulation-${selectedRegulation.id}`}
                      src={selectedRegulation.type === 'link' ? selectedRegulation.content : selectedRegulationBlobUrl}
                      style={{ width: '100%', height: 'calc(100vh - 170px)', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff' }}
                    />
                  ) : (
                    <div
                      style={{
                        maxHeight: '65vh',
                        overflowY: 'auto',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 8,
                        background: '#fff',
                        padding: 12,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.55,
                        fontSize: 13,
                        color: 'var(--gray-800)',
                      }}
                    >
                      {String(selectedRegulation.description || '').trim() || 'Текст регламента пока недоступен.'}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                  {(selectedRegulation.type === 'link' && selectedRegulation.content) || selectedRegulationBlobUrl ? (
                    <button
                      className="btn btn-outline"
                      onClick={() => window.open(selectedRegulation.type === 'link' ? selectedRegulation.content : selectedRegulationBlobUrl, '_blank', 'noopener,noreferrer')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Maximize2 size={14} /> На весь экран
                    </button>
                  ) : null}
                  <button
                    className="btn btn-secondary"
                    onClick={() => downloadRegulation(selectedRegulation)}
                    disabled={!!busyMap[`download-${selectedRegulation.id}`]}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download size={14} /> Скачать
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
























