import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { usersAPI, departmentsAPI, subdivisionsAPI } from '../../api/auth';

function extractErrorMessage(e, fallback) {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    const firstVal = data[firstKey];
    if (Array.isArray(firstVal) && firstVal.length) return String(firstVal[0]);
    if (typeof firstVal === 'string') return firstVal;
  }
  return fallback;
}

export default function AdminDepartmentsSubdivisions() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');

  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [creatingSubdivision, setCreatingSubdivision] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentComment, setNewDepartmentComment] = useState('');
  const [newSubdivisionName, setNewSubdivisionName] = useState('');
  const [newSubdivisionDepartmentId, setNewSubdivisionDepartmentId] = useState('');

  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');
  const [editingDepartmentComment, setEditingDepartmentComment] = useState('');
  const [savingDepartmentId, setSavingDepartmentId] = useState(null);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState(null);

  const [editingSubdivisionId, setEditingSubdivisionId] = useState(null);
  const [editingSubdivisionName, setEditingSubdivisionName] = useState('');
  const [editingSubdivisionDepartmentId, setEditingSubdivisionDepartmentId] = useState('');
  const [savingSubdivisionId, setSavingSubdivisionId] = useState(null);
  const [deletingSubdivisionId, setDeletingSubdivisionId] = useState(null);

  const [transferSourceDepartmentId, setTransferSourceDepartmentId] = useState(null);
  const [transferTargetDepartmentId, setTransferTargetDepartmentId] = useState('');
  const [transferringDepartmentId, setTransferringDepartmentId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, departmentsRes, subdivisionsRes] = await Promise.all([
        usersAPI.list(),
        departmentsAPI.list(),
        subdivisionsAPI.list(),
      ]);
      const nextUsers = Array.isArray(usersRes?.data) ? usersRes.data : [];
      const nextDepartments = Array.isArray(departmentsRes?.data) ? departmentsRes.data : [];
      const nextSubdivisions = Array.isArray(subdivisionsRes?.data) ? subdivisionsRes.data : [];

      setUsers(nextUsers);
      setDepartments(nextDepartments);
      setSubdivisions(nextSubdivisions);
      if (!newSubdivisionDepartmentId && nextDepartments.length > 0) {
        setNewSubdivisionDepartmentId(String(nextDepartments[0].id));
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Не удалось загрузить данные страницы.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const subdivisionsByDepartment = useMemo(() => {
    return subdivisions.reduce((acc, item) => {
      const key = String(item.department_id || '');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [subdivisions]);

  const userCountByDepartment = useMemo(() => {
    return users.reduce((acc, user) => {
      const key = String(user.department || '');
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const clearOrgMessages = () => {
    setOrgError('');
    setOrgSuccess('');
  };

  const createDepartment = async () => {
    const name = String(newDepartmentName || '').trim();
    if (!name) return;
    setCreatingDepartment(true);
    clearOrgMessages();
    try {
      await departmentsAPI.create({ name, comment: newDepartmentComment.trim(), is_active: true });
      setNewDepartmentName('');
      setNewDepartmentComment('');
      setOrgSuccess('Отдел создан.');
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось создать отдел.'));
    } finally {
      setCreatingDepartment(false);
    }
  };

  const createSubdivision = async () => {
    const name = String(newSubdivisionName || '').trim();
    const departmentId = Number(newSubdivisionDepartmentId);
    if (!name || !departmentId) return;
    setCreatingSubdivision(true);
    clearOrgMessages();
    try {
      await subdivisionsAPI.create({ name, department: departmentId, is_active: true });
      setNewSubdivisionName('');
      setOrgSuccess('Подотдел создан.');
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось создать подотдел.'));
    } finally {
      setCreatingSubdivision(false);
    }
  };

  const startEditDepartment = (department) => {
    setEditingDepartmentId(department.id);
    setEditingDepartmentName(department.name || '');
    setEditingDepartmentComment(department.comment || '');
  };

  const cancelEditDepartment = () => {
    setEditingDepartmentId(null);
    setEditingDepartmentName('');
    setEditingDepartmentComment('');
  };

  const saveDepartment = async (departmentId) => {
    const name = String(editingDepartmentName || '').trim();
    if (!name) return;
    setSavingDepartmentId(departmentId);
    clearOrgMessages();
    try {
      await departmentsAPI.update(departmentId, { name, comment: editingDepartmentComment.trim() });
      setOrgSuccess('Отдел обновлен.');
      cancelEditDepartment();
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось обновить отдел.'));
    } finally {
      setSavingDepartmentId(null);
    }
  };

  const cancelTransfer = () => {
    setTransferSourceDepartmentId(null);
    setTransferTargetDepartmentId('');
  };

  const transferUsersAndDeleteDepartment = async (department) => {
    const targetId = Number(transferTargetDepartmentId);
    if (!targetId || targetId === Number(department.id)) return;

    setTransferringDepartmentId(department.id);
    clearOrgMessages();
    try {
      const res = await departmentsAPI.transferUsers(department.id, {
        target_department_id: targetId,
        delete_source: true,
      });
      const movedCount = Number(res?.data?.moved_count || 0);
      setOrgSuccess(`Пользователи перенесены (${movedCount}), отдел удален.`);
      cancelTransfer();
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось перенести пользователей и удалить отдел.'));
    } finally {
      setTransferringDepartmentId(null);
    }
  };

  const removeDepartment = async (department) => {
    const usersInDepartment = userCountByDepartment[String(department.id)] || 0;
    if (usersInDepartment > 0) {
      const firstTarget = departments.find((d) => d.id !== department.id);
      setTransferSourceDepartmentId(department.id);
      setTransferTargetDepartmentId(firstTarget ? String(firstTarget.id) : '');
      clearOrgMessages();
      return;
    }

    const confirmed = window.confirm(`Удалить отдел "${department.name}"?`);
    if (!confirmed) return;
    setDeletingDepartmentId(department.id);
    clearOrgMessages();
    try {
      await departmentsAPI.delete(department.id);
      setOrgSuccess('Отдел удален.');
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось удалить отдел.'));
    } finally {
      setDeletingDepartmentId(null);
    }
  };

  const startEditSubdivision = (subdivision) => {
    setEditingSubdivisionId(subdivision.id);
    setEditingSubdivisionName(subdivision.name || '');
    setEditingSubdivisionDepartmentId(String(subdivision.department_id || ''));
  };

  const cancelEditSubdivision = () => {
    setEditingSubdivisionId(null);
    setEditingSubdivisionName('');
    setEditingSubdivisionDepartmentId('');
  };

  const saveSubdivision = async (subdivisionId) => {
    const name = String(editingSubdivisionName || '').trim();
    const departmentId = Number(editingSubdivisionDepartmentId);
    if (!name || !departmentId) return;
    setSavingSubdivisionId(subdivisionId);
    clearOrgMessages();
    try {
      await subdivisionsAPI.update(subdivisionId, {
        name,
        department: departmentId,
      });
      setOrgSuccess('Подотдел обновлен.');
      cancelEditSubdivision();
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось обновить подотдел.'));
    } finally {
      setSavingSubdivisionId(null);
    }
  };

  const removeSubdivision = async (subdivision) => {
    const confirmed = window.confirm(`Удалить подотдел "${subdivision.name}"?`);
    if (!confirmed) return;
    setDeletingSubdivisionId(subdivision.id);
    clearOrgMessages();
    try {
      await subdivisionsAPI.delete(subdivision.id);
      setOrgSuccess('Подотдел удален.');
      await loadAll();
    } catch (e) {
      setOrgError(extractErrorMessage(e, 'Не удалось удалить подотдел.'));
    } finally {
      setDeletingSubdivisionId(null);
    }
  };

  return (
    <MainLayout title="Отделы и подотделы">
      <div className="page-header">
        <div>
          <div className="page-title">Отделы и подотделы</div>
          <div className="page-subtitle">Создание и управление структурой компании</div>
        </div>
      </div>

      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {orgError && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{orgError}</div></div>}
      {orgSuccess && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#166534' }}>{orgSuccess}</div></div>}
      {loading && <div className="card"><div className="card-body">Загрузка...</div></div>}

      {!loading && (
        <div className="card">
          <div className="card-header"><span className="card-title">Отделы и подотделы</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Создать отдел</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="Название отдела" value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createDepartment()} />
                    <button className="btn btn-primary" type="button" onClick={createDepartment} disabled={creatingDepartment || !newDepartmentName.trim()}>
                      {creatingDepartment ? 'Создаем...' : 'Создать'}
                    </button>
                  </div>
                  <textarea className="form-input" placeholder="Описание / комментарий (необязательно)" value={newDepartmentComment} onChange={(e) => setNewDepartmentComment(e.target.value)} rows={2} style={{ resize: 'vertical', fontSize: 13 }} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Создать подотдел</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <select className="form-select" value={newSubdivisionDepartmentId} onChange={(e) => setNewSubdivisionDepartmentId(e.target.value)}>
                    <option value="">Выберите отдел</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                  <input className="form-input" placeholder="Название подотдела" value={newSubdivisionName} onChange={(e) => setNewSubdivisionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSubdivision()} />
                  <button className="btn btn-primary" type="button" onClick={createSubdivision} disabled={creatingSubdivision || !newSubdivisionDepartmentId || !newSubdivisionName.trim()}>
                    {creatingSubdivision ? 'Создаем...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10 }}>
                Если в отделе есть пользователи, при удалении будет предложен перенос в другой отдел.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {departments.map((department) => {
                  const items = subdivisionsByDepartment[String(department.id)] || [];
                  const usersInDepartment = userCountByDepartment[String(department.id)] || 0;
                  const isEditingDepartment = editingDepartmentId === department.id;
                  const isTransferForThisDepartment = transferSourceDepartmentId === department.id;
                  const transferOptions = departments.filter((d) => d.id !== department.id);

                  return (
                    <div key={department.id} className="card" style={{ border: '1px solid var(--gray-200)' }}>
                      <div className="card-body" style={{ padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            {!isEditingDepartment ? (
                              <>
                                <div style={{ fontWeight: 700 }}>{department.name}</div>
                                {department.comment && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{department.comment}</div>}
                              </>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <input className="form-input" value={editingDepartmentName} onChange={(e) => setEditingDepartmentName(e.target.value)} />
                                <textarea className="form-input" placeholder="Описание / комментарий" value={editingDepartmentComment} onChange={(e) => setEditingDepartmentComment(e.target.value)} rows={2} style={{ resize: 'vertical', fontSize: 13 }} />
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {!isEditingDepartment ? (
                              <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEditDepartment(department)}>Редактировать</button>
                            ) : (
                              <>
                                <button className="btn btn-primary btn-sm" type="button" onClick={() => saveDepartment(department.id)} disabled={savingDepartmentId === department.id || !editingDepartmentName.trim()}>
                                  {savingDepartmentId === department.id ? 'Сохраняем...' : 'Сохранить'}
                                </button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={cancelEditDepartment}>Отмена</button>
                              </>
                            )}
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => removeDepartment(department)} disabled={deletingDepartmentId === department.id || transferringDepartmentId === department.id}>
                              {deletingDepartmentId === department.id ? 'Удаляем...' : 'Удалить'}
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Пользователей в отделе: {usersInDepartment}</div>

                        {isTransferForThisDepartment && (
                          <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                            <div style={{ fontSize: 12, color: '#1e3a8a', marginBottom: 8 }}>Выберите целевой отдел, чтобы перенести пользователей и удалить текущий отдел.</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                              <select className="form-select" value={transferTargetDepartmentId} onChange={(e) => setTransferTargetDepartmentId(e.target.value)}>
                                <option value="">Выберите отдел</option>
                                {transferOptions.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                              </select>
                              <button className="btn btn-primary btn-sm" type="button" onClick={() => transferUsersAndDeleteDepartment(department)} disabled={!transferTargetDepartmentId || transferringDepartmentId === department.id}>
                                {transferringDepartmentId === department.id ? 'Переносим...' : 'Перенести и удалить'}
                              </button>
                              <button className="btn btn-secondary btn-sm" type="button" onClick={cancelTransfer}>Отмена</button>
                            </div>
                          </div>
                        )}

                        {items.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Подотделов пока нет</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map((item) => {
                              const isEditingSubdivision = editingSubdivisionId === item.id;
                              return (
                                <div key={item.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                                  {!isEditingSubdivision ? (
                                    <div style={{ fontSize: 13 }}>{item.name}</div>
                                  ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <input className="form-input" value={editingSubdivisionName} onChange={(e) => setEditingSubdivisionName(e.target.value)} />
                                      <select className="form-select" value={editingSubdivisionDepartmentId} onChange={(e) => setEditingSubdivisionDepartmentId(e.target.value)}>
                                        <option value="">Выберите отдел</option>
                                        {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                                      </select>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {!isEditingSubdivision ? (
                                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEditSubdivision(item)}>Редактировать</button>
                                    ) : (
                                      <>
                                        <button className="btn btn-primary btn-sm" type="button" onClick={() => saveSubdivision(item.id)} disabled={savingSubdivisionId === item.id || !editingSubdivisionName.trim() || !editingSubdivisionDepartmentId}>
                                          {savingSubdivisionId === item.id ? 'Сохраняем...' : 'Сохранить'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" type="button" onClick={cancelEditSubdivision}>Отмена</button>
                                      </>
                                    )}
                                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => removeSubdivision(item)} disabled={deletingSubdivisionId === item.id}>
                                      {deletingSubdivisionId === item.id ? 'Удаляем...' : 'Удалить'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
