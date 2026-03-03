import MainLayout from '../../layouts/MainLayout';
import { CONTENT_MODULES } from '../../data/mockData';
import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Link, Upload, ChevronRight, ClipboardCheck } from 'lucide-react';
import { regulationsAPI } from '../../api/content';

const MODULE_STORAGE_PREFIX = 'vpluse_admin_content_module_v1_';

function todayLabel() {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  } catch {
    return 'today';
  }
}

function getDefaultModuleItems(module) {
  return [
    { id: 1, title: `${module.title}: материал 1`, desc: 'Текущая запись модуля', date: '27 фев. 2026' },
    { id: 2, title: `${module.title}: материал 2`, desc: 'Текущая запись модуля', date: '26 фев. 2026' },
  ];
}

function loadModuleItems(module) {
  const key = `${MODULE_STORAGE_PREFIX}${module.id}`;
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore broken localStorage
  }
  return getDefaultModuleItems(module);
}

function saveModuleItems(moduleId, items) {
  localStorage.setItem(`${MODULE_STORAGE_PREFIX}${moduleId}`, JSON.stringify(items));
}

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function humanFileLabel(fileName = '') {
  const ext = String(fileName).split('.').pop()?.toUpperCase();
  if (!ext || ext === fileName.toUpperCase()) return 'Файл';
  if (ext === 'PDF') return 'PDF';
  if (ext === 'DOC' || ext === 'DOCX') return 'DOCX';
  if (ext === 'PNG' || ext === 'JPG' || ext === 'JPEG' || ext === 'WEBP') return 'Изображение';
  return ext;
}

function normalizeDoc(raw) {
  const title = raw.title || raw.name || raw.file_name || raw.filename || 'Без названия';
  const desc = raw.description || raw.desc || raw.summary || '';
  const fileUrl = raw.file || raw.file_url || raw.document || '';
  const externalUrl = raw.external_url || raw.url || '';
  const typeRaw = String(raw.type || raw.kind || '').toLowerCase();
  const isLink = typeRaw.includes('link') || (!fileUrl && Boolean(externalUrl));
  const format = isLink ? 'Внешняя ссылка' : humanFileLabel(fileUrl || raw.file_name || title);
  const dateRaw = raw.updated_at || raw.modified || raw.created_at || raw.date;
  const date = dateRaw ? new Date(dateRaw).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : todayLabel();

  return {
    id: raw.id,
    title,
    desc: desc || externalUrl || '',
    format,
    date,
    href: externalUrl || fileUrl || '',
    quizRequired: Boolean(raw.quiz_required),
    quizQuestion: raw.quiz_question || raw.quiz?.question || '',
    quizOptions: Array.isArray(raw.quiz_options)
      ? raw.quiz_options
      : Array.isArray(raw.quiz?.options)
        ? raw.quiz.options
        : [],
  };
}

export default function AdminContent() {
  const [view, setView] = useState('hub');
  const normalizedView = view === 'regs' ? 'regulations' : view;
  const selectedModule =
    CONTENT_MODULES.find((m) => m.id === view) ||
    CONTENT_MODULES.find((m) => m.id === normalizedView) ||
    null;

  if (normalizedView === 'regulations') {
    return <RegulationsManage onBack={() => setView('hub')} />;
  }

  if (selectedModule) {
    return <GenericModuleManage module={selectedModule} onBack={() => setView('hub')} />;
  }

  return (
    <MainLayout title="Администрирование">
      <div className="page-header">
        <div className="page-title">Управление контентом</div>
        <div className="page-subtitle">Редактирование информации на страницах платформы</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {CONTENT_MODULES.map((mod) => (
          <div
            key={mod.id}
            className="card"
            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
            onClick={() => setView(mod.id === 'regs' ? 'regulations' : mod.id)}
          >
            <div className="card-body">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-lg)',
                  background: mod.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  marginBottom: 14,
                }}
              >
                {mod.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{mod.title}</div>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 14 }}>{mod.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 12,
                    color: mod.id === 'welcome' ? 'var(--gray-500)' : mod.id === 'instruction' ? 'var(--success)' : 'var(--primary)',
                    fontWeight: 500,
                  }}
                >
                  {mod.stat}
                </span>
                <span style={{ fontSize: 13, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {mod.link} <ChevronRight size={13} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}

function GenericModuleManage({ module, onBack }) {
  const [items, setItems] = useState(() => loadModuleItems(module));
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', desc: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    setItems(loadModuleItems(module));
    setSearch('');
    setEditId(null);
    setForm({ title: '', desc: '' });
    setStatus('');
  }, [module]);

  useEffect(() => {
    saveModuleItems(module.id, items);
  }, [module.id, items]);

  const filtered = items.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditId(null);
    setForm({ title: '', desc: '' });
    setStatus('Режим: новая запись');
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({ title: row.title, desc: row.desc || '' });
    setStatus(`Редактирование записи #${row.id}`);
  };

  const save = () => {
    if (!form.title.trim()) {
      setStatus('Введите название записи');
      return;
    }

    const date = todayLabel();
    if (editId) {
      setItems((prev) => prev.map((x) => (x.id === editId ? { ...x, title: form.title.trim(), desc: form.desc.trim(), date } : x)));
      setStatus('Изменения сохранены');
      return;
    }

    setItems((prev) => [{ id: Date.now(), title: form.title.trim(), desc: form.desc.trim(), date }, ...prev]);
    setStatus('Новая запись сохранена');
  };

  const remove = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editId === id) {
      setEditId(null);
      setForm({ title: '', desc: '' });
    }
    setStatus('Запись удалена');
  };

  return (
    <MainLayout title="Управление контентом">
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ fontSize: 13, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Контент
        </button>
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">{module.title}</div>
          <div className="page-subtitle">{module.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={openCreate}>
            <Plus size={13} /> Добавить запись
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <input className="form-input" placeholder="Название" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea className="form-textarea" placeholder="Описание" value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} />
          {status && <div style={{ fontSize: 12, color: status === 'Введите название записи' ? 'var(--danger)' : 'var(--gray-500)' }}>{status}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 13, color: 'var(--gray-500)', flexShrink: 0 }}>{filtered.length} записей</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ЗАПИСЬ</th>
                <th>ОПИСАНИЕ</th>
                <th>ОБНОВЛЕНО</th>
                <th>ДЕЙСТВИЯ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>{row.title}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{row.desc || '—'}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{row.date}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(row)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => remove(row.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

function RegulationsManage({ onBack }) {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const res = await regulationsAPI.list();
      setDocs(safeList(res.data).map(normalizeDoc));
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось загрузить регламенты');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const filtered = docs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  const addLink = async () => {
    const url = window.prompt('Введите ссылку');
    if (!url?.trim()) return;
    const name = window.prompt('Название ссылки') || url;
    const description = window.prompt('Описание (необязательно)') || '';

    setSubmitting(true);
    try {
      await regulationsAPI.create({ title: name.trim(), description: description.trim(), type: 'link', external_url: url.trim() });
      setStatus('Ссылка добавлена');
      await loadDocs();
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось добавить ссылку');
    } finally {
      setSubmitting(false);
    }
  };

  const onPickFile = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const title = window.prompt('Название документа', file.name.replace(/\.[^.]+$/, '')) || file.name;
    const description = window.prompt('Описание (необязательно)') || '';

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('type', 'file');
    formData.append('file', file);

    setSubmitting(true);
    try {
      await regulationsAPI.create(formData);
      setStatus(`Файл «${file.name}» загружен`);
      await loadDocs();
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setSubmitting(false);
    }
  };

  const editDoc = async (doc) => {
    const nextTitle = window.prompt('Название', doc.title);
    if (!nextTitle?.trim()) return;
    const nextDesc = window.prompt('Описание', doc.desc || '') || '';

    setSubmitting(true);
    try {
      await regulationsAPI.update(doc.id, { title: nextTitle.trim(), description: nextDesc.trim() });
      setStatus('Документ обновлен');
      await loadDocs();
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось обновить документ');
    } finally {
      setSubmitting(false);
    }
  };

  const editQuiz = async (doc) => {
    const enabledDefault = doc.quizRequired ? 'да' : 'нет';
    const enabledInput = window.prompt('Включить мини-тест для стажеров? (да/нет)', enabledDefault);
    if (enabledInput === null) return;
    const enabled = String(enabledInput).trim().toLowerCase();
    const quizRequired = enabled === 'да' || enabled === 'yes' || enabled === 'y' || enabled === 'true' || enabled === '1';

    let payload = { quiz_required: quizRequired };
    if (quizRequired) {
      const question = window.prompt('Вопрос теста', doc.quizQuestion || '');
      if (!question?.trim()) {
        setStatus('Вопрос теста обязателен');
        return;
      }
      const optionsDefault = (doc.quizOptions || []).join(' ; ');
      const optionsRaw = window.prompt('Варианты ответа через ; (минимум 2)', optionsDefault);
      if (!optionsRaw?.trim()) {
        setStatus('Добавьте варианты ответа');
        return;
      }
      const options = optionsRaw
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
      if (options.length < 2) {
        setStatus('Нужно минимум 2 варианта ответа');
        return;
      }
      const answer = window.prompt('Правильный ответ (точно как один из вариантов)', options[0] || '');
      if (!answer?.trim()) {
        setStatus('Правильный ответ обязателен');
        return;
      }

      payload = {
        ...payload,
        quiz_question: question.trim(),
        quiz_options: options,
        quiz_expected_answer: answer.trim(),
      };
    } else {
      payload = {
        ...payload,
        quiz_question: '',
        quiz_options: [],
      };
    }

    setSubmitting(true);
    try {
      await regulationsAPI.update(doc.id, payload);
      setStatus(quizRequired ? 'Мини-тест обновлен' : 'Мини-тест отключен');
      await loadDocs();
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось сохранить настройки мини-теста');
    } finally {
      setSubmitting(false);
    }
  };

  const removeDoc = async (id) => {
    if (!window.confirm('Удалить документ?')) return;

    setSubmitting(true);
    try {
      await regulationsAPI.delete(id);
      setStatus('Документ удален');
      await loadDocs();
    } catch (err) {
      setStatus(err?.response?.data?.detail || 'Не удалось удалить документ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout title="Управление контентом">
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ fontSize: 13, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Контент
        </button>
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">Регламенты и база знаний</div>
          <div className="page-subtitle">Загрузка документов, добавление внешних ссылок на регламенты.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={addLink} disabled={submitting}>
            <Link size={13} /> Добавить ссылку
          </button>
          <button className="btn btn-primary btn-sm" onClick={onPickFile} disabled={submitting}>
            <Upload size={13} /> Загрузить файл
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileSelected} />
        </div>
      </div>

      {status && <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--gray-500)' }}>{status}</div>}

      <div className="card">
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 13, color: 'var(--gray-500)', flexShrink: 0 }}>{loading ? 'Загрузка...' : `${filtered.length} документов`}</span>
          <button className="btn btn-secondary btn-sm">Фильтры</button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>НАЗВАНИЕ ДОКУМЕНТА</th>
                <th>ФОРМАТ</th>
                <th>ДАТА ИЗМЕНЕНИЯ</th>
                <th>ДЕЙСТВИЯ</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--gray-500)' }}>
                    Загрузка...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--gray-500)' }}>
                    Документов пока нет
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: doc.format.includes('ссылка') ? '#EDE9FE' : doc.format.includes('PDF') ? '#FEE2E2' : '#DBEAFE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{doc.format.includes('ссылка') ? '🔗' : '📄'}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {doc.href ? (
                              <a href={doc.href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                {doc.title}
                              </a>
                            ) : (
                              doc.title
                            )}
                            {doc.quizRequired && <span className="badge badge-yellow">Мини-тест</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{doc.desc?.slice(0, 50)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{doc.format}</td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{doc.date}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => editDoc(doc)} disabled={submitting}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn-icon" title="Настроить мини-тест" onClick={() => editQuiz(doc)} disabled={submitting}>
                          <ClipboardCheck size={13} />
                        </button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeDoc(doc.id)} disabled={submitting}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
