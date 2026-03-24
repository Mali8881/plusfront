import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { coursesAdminAPI, instructionsAPI, lessonsAdminAPI, newsAPI, regulationsAPI } from '../../api/content';
import { departmentsAPI } from '../../api/auth';

const emptyNews = { title: '', full_text: '', language: 'ru' };
const createEmptyQuizQuestion = () => ({ question: '', options: ['', ''], correct_answer: '' });
const emptyReg = {
  title: '',
  description: '',
  type: 'link',
  url: '',
  quiz_allowed_mistakes: 1,
  quiz_questions: [],
};
const emptyInstruction = { language: 'ru', type: 'text', content: '', is_active: true };
const emptyCourse = { title: '', description: '', visibility: 'public', department: '', is_active: true };
const emptyLesson = { title: '', description: '', content: '', tags: '' };

export default function AdminContent() {
  const [tab, setTab] = useState('news');
  const [news, setNews] = useState([]);
  const [regs, setRegs] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newsForm, setNewsForm] = useState(emptyNews);
  const [newsEditId, setNewsEditId] = useState(null);
  const [newsImage, setNewsImage] = useState(null);

  const [regForm, setRegForm] = useState(emptyReg);
  const [regEditId, setRegEditId] = useState(null);
  const [regFile, setRegFile] = useState(null);

  const [instructionForm, setInstructionForm] = useState(emptyInstruction);
  const [instructionEditId, setInstructionEditId] = useState(null);

  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [courseEditId, setCourseEditId] = useState(null);
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignToAll, setAssignToAll] = useState(true);
  const [assignUserIds, setAssignUserIds] = useState('');

  const [lessons, setLessons] = useState([]);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [lessonEditId, setLessonEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [newsRes, regRes, instructionsRes, coursesRes, departmentsRes, lessonsRes] = await Promise.all([
        newsAPI.list(),
        regulationsAPI.list(),
        instructionsAPI.list(),
        coursesAdminAPI.list(),
        departmentsAPI.list(),
        lessonsAdminAPI.list(),
      ]);
      setNews(Array.isArray(newsRes.data) ? newsRes.data : []);
      setRegs(Array.isArray(regRes.data) ? regRes.data : []);
      setInstructions(Array.isArray(instructionsRes.data) ? instructionsRes.data : []);
      const coursesData = Array.isArray(coursesRes.data)
        ? coursesRes.data
        : Array.isArray(coursesRes.data?.results)
          ? coursesRes.data.results
          : [];
      setCourses(coursesData);
      const departmentsData = Array.isArray(departmentsRes.data)
        ? departmentsRes.data
        : Array.isArray(departmentsRes.data?.results)
          ? departmentsRes.data.results
          : [];
      setDepartments(departmentsData);
      setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить контент.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => ({
    news: news.length,
    regs: regs.length,
    instructions: instructions.length,
    courses: courses.length,
  }), [news, regs, instructions, courses]);

  const saveNews = async () => {
    if (!newsForm.title.trim()) return;
    const payload = new FormData();
    payload.append('title', newsForm.title);
    payload.append('full_text', newsForm.full_text || '');
    payload.append('language', newsForm.language || 'ru');
    payload.append('published_at', new Date().toISOString());
    payload.append('is_active', 'true');
    if (newsImage) payload.append('image', newsImage);
    try {
      if (newsEditId) await newsAPI.update(newsEditId, payload);
      else await newsAPI.create(payload);
      setNewsForm(emptyNews);
      setNewsEditId(null);
      setNewsImage(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Ошибка сохранения новости.');
    }
  };

  const saveReg = async () => {
    if (!regForm.title.trim()) return;
    if (regForm.type === 'file' && !regEditId && !regFile) {
      setError('Выберите файл перед добавлением регламента.');
      return;
    }

    const normalizedQuizQuestions = (regForm.quiz_questions || [])
      .map((item) => ({
        question: String(item.question || '').trim(),
        options: (item.options || []).map((opt) => String(opt || '').trim()).filter(Boolean),
        correct_answer: String(item.correct_answer || '').trim(),
      }))
      .filter((item) => item.question && item.options.length >= 2 && item.correct_answer);

    const payload = new FormData();
    payload.append('title', regForm.title);
    payload.append('description', regForm.description || '');
    payload.append('type', regForm.type);
    payload.append('is_active', 'true');
    payload.append('quiz_allowed_mistakes', String(Math.max(Number(regForm.quiz_allowed_mistakes || 0), 0)));
    payload.append('quiz_questions', JSON.stringify(normalizedQuizQuestions));
    payload.append('quiz_question', '');
    payload.append('quiz_expected_answer', '');

    if (regForm.type === 'link') {
      payload.append('external_url', regForm.url || '');
    } else {
      payload.append('external_url', '');
      if (regFile) payload.append('file', regFile);
    }

    try {
      if (regEditId) await regulationsAPI.update(regEditId, payload);
      else await regulationsAPI.create(payload);
      setRegForm(emptyReg);
      setRegEditId(null);
      setRegFile(null);
      await load();
    } catch (e) {
      const detail = e.response?.data;
      if (detail?.file?.[0]) setError(detail.file[0]);
      else setError(e.response?.data?.detail || 'Ошибка сохранения регламента.');
    }
  };

  const saveInstruction = async () => {
    const content = (instructionForm.content || '').trim();
    if (!content) return;
    const payload = {
      language: instructionForm.language,
      type: instructionForm.type,
      content,
      is_active: true,
    };
    try {
      if (instructionEditId) await instructionsAPI.update(instructionEditId, payload);
      else await instructionsAPI.create(payload);
      setInstructionForm(emptyInstruction);
      setInstructionEditId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Ошибка сохранения инструкции.');
    }
  };

  const saveCourse = async () => {
    const title = String(courseForm.title || '').trim();
    if (!title) return;

    const visibility = String(courseForm.visibility || 'public');
    const department = visibility === 'department' ? (courseForm.department || null) : null;

    const payload = {
      title,
      description: courseForm.description || '',
      visibility,
      department,
      is_active: Boolean(courseForm.is_active),
    };

    try {
      if (courseEditId) await coursesAdminAPI.update(courseEditId, payload);
      else await coursesAdminAPI.create(payload);
      setCourseForm(emptyCourse);
      setCourseEditId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить курс.');
    }
  };

  const assignCourse = async () => {
    const courseId = String(assignCourseId || '').trim();
    if (!courseId) {
      setError('Выберите курс для назначения.');
      return;
    }

    const rawIds = String(assignUserIds || '');
    const user_ids = rawIds
      .split(/[,\\s]+/)
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x) && x > 0);

    const payload = assignToAll ? { course_id: courseId, assign_to_all: true } : { course_id: courseId, user_ids };
    if (!assignToAll && user_ids.length === 0) {
      setError('Укажите user_ids или включите "назначить всем".');
      return;
    }

    try {
      await coursesAdminAPI.assign(payload);
      setAssignUserIds('');
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось назначить курс.');
    }
  };

  const updateQuizQuestion = (qIdx, patch) => {
    setRegForm((f) => ({
      ...f,
      quiz_questions: (f.quiz_questions || []).map((item, idx) => (idx === qIdx ? { ...item, ...patch } : item)),
    }));
  };

  const updateQuizOption = (qIdx, oIdx, value) => {
    setRegForm((f) => ({
      ...f,
      quiz_questions: (f.quiz_questions || []).map((item, idx) => {
        if (idx !== qIdx) return item;
        const nextOptions = [...(item.options || [])];
        nextOptions[oIdx] = value;
        return { ...item, options: nextOptions };
      }),
    }));
  };

  return (
    <MainLayout title="Администрирование">
      <div className="page-header">
        <div>
          <div className="page-title">Управление контентом</div>
          <div className="page-subtitle">Новости, регламенты и инструкции</div>
        </div>
      </div>

      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {loading && <div className="card"><div className="card-body">Загрузка...</div></div>}

      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <Stat title="Новости" value={stats.news} />
            <Stat title="Регламенты" value={stats.regs} />
            <Stat title="Инструкции" value={stats.instructions} />
            <Stat title="Уроки" value={lessons.length} />
          </div>

          <div className="tabs">
            <button className={`tab-btn ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>Новости</button>
            <button className={`tab-btn ${tab === 'regulations' ? 'active' : ''}`} onClick={() => setTab('regulations')}>Регламенты</button>
            <button className={`tab-btn ${tab === 'instructions' ? 'active' : ''}`} onClick={() => setTab('instructions')}>Инструкции</button>
            <button className={`tab-btn ${tab === 'lessons' ? 'active' : ''}`} onClick={() => setTab('lessons')}>Уроки</button>
          </div>

          {tab === 'news' && (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <input className="form-input" placeholder="Заголовок" value={newsForm.title} onChange={(e) => setNewsForm((f) => ({ ...f, title: e.target.value }))} />
                  <textarea className="form-textarea" placeholder="Текст новости" value={newsForm.full_text} onChange={(e) => setNewsForm((f) => ({ ...f, full_text: e.target.value }))} />
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input className="form-input" type="file" accept="image/*" onChange={(e) => setNewsImage(e.target.files?.[0] || null)} />
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{newsImage ? `Выбрано изображение: ${newsImage.name}` : 'Изображение не выбрано'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNews}><Plus size={13} /> {newsEditId ? 'Сохранить' : 'Добавить'}</button>
                    {newsEditId && <button className="btn btn-secondary btn-sm" onClick={() => { setNewsEditId(null); setNewsForm(emptyNews); setNewsImage(null); }}>Отмена</button>}
                  </div>
                </div>
              </div>
              <DataTable
                rows={news}
                columns={[{ key: 'title', label: 'ЗАГОЛОВОК' }, { key: 'published_at', label: 'ДАТА' }]}
                onEdit={(item) => {
                  setNewsEditId(item.id);
                  setNewsForm({ title: item.title || '', full_text: item.full_text || '', language: item.language || 'ru' });
                  setNewsImage(null);
                }}
                onDelete={async (item) => {
                  await newsAPI.delete(item.id);
                  await load();
                }}
              />
            </>
          )}

          {tab === 'regulations' && (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <input className="form-input" placeholder="Название" value={regForm.title} onChange={(e) => setRegForm((f) => ({ ...f, title: e.target.value }))} />
                  <textarea className="form-textarea" placeholder="Описание" value={regForm.description} onChange={(e) => setRegForm((f) => ({ ...f, description: e.target.value }))} />
                  <select className="form-select" value={regForm.type} onChange={(e) => { setRegForm((f) => ({ ...f, type: e.target.value })); setRegFile(null); }}>
                    <option value="link">Ссылка</option>
                    <option value="file">Файл</option>
                  </select>

                  <div className="form-group">
                    <label className="form-label">Допустимые ошибки</label>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={5}
                      value={regForm.quiz_allowed_mistakes}
                      onChange={(e) => setRegForm((f) => ({ ...f, quiz_allowed_mistakes: e.target.value }))}
                    />
                  </div>

                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Тест по регламенту</div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setRegForm((f) => ({ ...f, quiz_questions: [...(f.quiz_questions || []), createEmptyQuizQuestion()] }))}
                      >
                        <Plus size={13} /> Добавить вопрос
                      </button>
                    </div>
                    {(regForm.quiz_questions || []).map((q, qIdx) => (
                      <div key={`quiz-${qIdx}`} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8, display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Вопрос {qIdx + 1}</div>
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setRegForm((f) => ({ ...f, quiz_questions: (f.quiz_questions || []).filter((_, idx) => idx !== qIdx) }))}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <input
                          className="form-input"
                          placeholder="Текст вопроса"
                          value={q.question || ''}
                          onChange={(e) => updateQuizQuestion(qIdx, { question: e.target.value })}
                        />
                        {(q.options || []).map((opt, oIdx) => (
                          <div key={`quiz-${qIdx}-opt-${oIdx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
                            <input
                              className="form-input"
                              placeholder={`Вариант ${oIdx + 1}`}
                              value={opt || ''}
                              onChange={(e) => updateQuizOption(qIdx, oIdx, e.target.value)}
                            />
                            <button
                              type="button"
                              className={`btn btn-sm ${String(q.correct_answer || '') === String(opt || '') ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => updateQuizQuestion(qIdx, { correct_answer: q.options?.[oIdx] || '' })}
                            >
                              Правильный
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ color: 'var(--danger)' }}
                              onClick={() =>
                                setRegForm((f) => ({
                                  ...f,
                                  quiz_questions: (f.quiz_questions || []).map((item, idx) => {
                                    if (idx !== qIdx) return item;
                                    const nextOptions = (item.options || []).filter((_, i) => i !== oIdx);
                                    const nextCorrect = nextOptions.includes(item.correct_answer) ? item.correct_answer : '';
                                    return { ...item, options: nextOptions, correct_answer: nextCorrect };
                                  }),
                                }))
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setRegForm((f) => ({
                              ...f,
                              quiz_questions: (f.quiz_questions || []).map((item, idx) =>
                                idx === qIdx ? { ...item, options: [...(item.options || []), ''] } : item
                              ),
                            }))
                          }
                        >
                          <Plus size={13} /> Добавить вариант
                        </button>
                      </div>
                    ))}
                    {(regForm.quiz_questions || []).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Без вопросов тест по регламенту не обязателен.</div>
                    )}
                  </div>

                  {regForm.type === 'link' && (
                    <input className="form-input" placeholder="https://..." value={regForm.url} onChange={(e) => setRegForm((f) => ({ ...f, url: e.target.value }))} />
                  )}
                  {regForm.type === 'file' && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <input className="form-input" type="file" accept=".pdf,application/pdf" onChange={(e) => setRegFile(e.target.files?.[0] || null)} />
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{regFile ? `Выбран файл: ${regFile.name}` : 'Файл не выбран'}</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveReg}><Plus size={13} /> {regEditId ? 'Сохранить' : 'Добавить'}</button>
                    {regEditId && <button className="btn btn-secondary btn-sm" onClick={() => { setRegEditId(null); setRegForm(emptyReg); setRegFile(null); }}>Отмена</button>}
                  </div>
                </div>
              </div>
              <DataTable
                rows={regs}
                columns={[
                  { key: 'title', label: 'НАЗВАНИЕ' },
                  { key: 'type', label: 'ТИП' },
                  { key: 'quiz_questions_count', label: 'ВОПРОСОВ' },
                  { key: 'created_at', label: 'СОЗДАНО' },
                ]}
                onEdit={(item) => {
                  setRegEditId(item.id);
                  setRegForm({
                    title: item.title || '',
                    description: item.description || '',
                    type: item.type || 'link',
                    url: item.external_url || '',
                    quiz_allowed_mistakes: item.quiz_allowed_mistakes ?? 1,
                    quiz_questions: Array.isArray(item.quiz_questions) ? item.quiz_questions : [],
                  });
                  setRegFile(null);
                }}
                onDelete={async (item) => {
                  await regulationsAPI.delete(item.id);
                  await load();
                }}
                mapRow={(row) => ({ ...row, quiz_questions_count: Array.isArray(row.quiz_questions) ? row.quiz_questions.length : 0 })}
              />
            </>
          )}

          {tab === 'instructions' && (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select className="form-select" value={instructionForm.language} onChange={(e) => setInstructionForm((f) => ({ ...f, language: e.target.value }))}>
                      <option value="ru">RU</option>
                      <option value="en">EN</option>
                      <option value="kg">KG</option>
                    </select>
                    <select className="form-select" value={instructionForm.type} onChange={(e) => setInstructionForm((f) => ({ ...f, type: e.target.value }))}>
                      <option value="text">Текст</option>
                      <option value="link">Ссылка</option>
                    </select>
                  </div>
                  <textarea className="form-textarea" placeholder={instructionForm.type === 'link' ? 'https://...' : 'Текст инструкции'} value={instructionForm.content} onChange={(e) => setInstructionForm((f) => ({ ...f, content: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveInstruction}><Plus size={13} /> {instructionEditId ? 'Сохранить' : 'Добавить инструкцию'}</button>
                    {instructionEditId && <button className="btn btn-secondary btn-sm" onClick={() => { setInstructionEditId(null); setInstructionForm(emptyInstruction); }}>Отмена</button>}
                  </div>
                </div>
              </div>
              <DataTable
                rows={instructions}
                columns={[
                  { key: 'type', label: 'ТИП' },
                  { key: 'language', label: 'ЯЗЫК' },
                  { key: 'content', label: 'СОДЕРЖАНИЕ' },
                  { key: 'updated_at', label: 'ОБНОВЛЕНО' },
                ]}
                onEdit={(item) => {
                  setInstructionEditId(item.id);
                  setInstructionForm({ language: item.language || 'ru', type: item.type || 'text', content: item.content || '', is_active: true });
                }}
                onDelete={async (item) => {
                  await instructionsAPI.delete(item.id);
                  await load();
                }}
              />
            </>
          )}

          {tab === 'lessons' && (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-header">
                  <span className="card-title">{lessonEditId ? 'Редактировать урок' : 'Новый урок'}</span>
                </div>
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <input
                    className="form-input"
                    placeholder="Заголовок"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <input
                    className="form-input"
                    placeholder="Описание (краткое)"
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <textarea
                    className="form-textarea"
                    placeholder="Содержимое урока"
                    value={lessonForm.content}
                    onChange={(e) => setLessonForm((f) => ({ ...f, content: e.target.value }))}
                    style={{ minHeight: 100 }}
                  />
                  <input
                    className="form-input"
                    placeholder='Теги через запятую, напр: Продажи, Переговоры'
                    value={lessonForm.tags}
                    onChange={(e) => setLessonForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!lessonForm.title.trim()}
                      onClick={async () => {
                        const tags = lessonForm.tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean);
                        const payload = {
                          title: lessonForm.title.trim(),
                          description: lessonForm.description.trim(),
                          content: lessonForm.content.trim(),
                          tags,
                        };
                        if (lessonEditId) {
                          await lessonsAdminAPI.update(lessonEditId, payload);
                        } else {
                          await lessonsAdminAPI.create(payload);
                        }
                        setLessonForm(emptyLesson);
                        setLessonEditId(null);
                        await load();
                      }}
                    >
                      <Plus size={13} /> {lessonEditId ? 'Сохранить' : 'Добавить урок'}
                    </button>
                    {lessonEditId && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setLessonEditId(null); setLessonForm(emptyLesson); }}>
                        Отмена
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <DataTable
                rows={lessons}
                columns={[
                  { key: 'title', label: 'НАЗВАНИЕ' },
                  { key: 'description', label: 'ОПИСАНИЕ' },
                  { key: 'tags_str', label: 'ТЕГИ' },
                ]}
                mapRow={(row) => ({ ...row, tags_str: Array.isArray(row.tags) ? row.tags.join(', ') : '' })}
                onEdit={(item) => {
                  setLessonEditId(item.id);
                  setLessonForm({
                    title: item.title || '',
                    description: item.description || '',
                    content: item.content || '',
                    tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
                  });
                }}
                onDelete={async (item) => {
                  await lessonsAdminAPI.delete(item.id);
                  await load();
                }}
              />
            </>
          )}
        </>
      )}
    </MainLayout>
  );
}

function Stat({ title, value }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function DataTable({ rows, columns, onEdit, onDelete, hideActions = false, mapRow }) {
  const prepared = (rows || []).map((row) => (mapRow ? mapRow(row) : row));
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key}>{c.label}</th>)}
              {!hideActions && <th>ДЕЙСТВИЯ</th>}
            </tr>
          </thead>
          <tbody>
            {prepared.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={`${row.id}-${c.key}`}>{String(row[c.key] ?? '').slice(0, 120) || '-'}</td>
                ))}
                {!hideActions && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => onEdit?.(row)}><Pencil size={13} /></button>
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => onDelete?.(row)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {prepared.length === 0 && (
              <tr><td colSpan={columns.length + (hideActions ? 0 : 1)}>Данных пока нет.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
