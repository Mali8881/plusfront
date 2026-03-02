import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { DEPARTMENTS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { orgStructureAPI } from '../../api/auth';

const ORG_STORAGE_KEY = 'vpluse_company_structure_v1';
const NODE_COLORS = ['#d9f99d', '#fde68a', '#ddd6fe', '#fbcfe8', '#bfdbfe', '#a5f3fc', '#fecaca', '#fdba74', '#bbf7d0'];

const normalize = (v) => (v || '').toString().trim().toLowerCase();

const flattenTree = (items = []) => {
  const flat = [];
  const walk = (node, parentId = null) => {
    flat.push({
      id: node.id,
      name: node.name || '',
      parentId: node.parent ?? parentId,
      headName: node.head_name || '',
      headRole: node.head_role || '',
      description: node.description || '',
      color: node.color || '#D9F99D',
      sortOrder: node.sort_order || 0,
      department: node.department || null,
      code: node.code || '',
    });
    (node.children || []).forEach((child) => walk(child, node.id));
  };
  items.forEach((root) => walk(root, null));
  return flat;
};

const createDefaultNodes = (users = []) => {
  const nodes = [
    {
      id: 1,
      name: 'Генеральный директор',
      parentId: null,
      headName: 'Лиховцов Андрей Юрьевич',
      headRole: 'Генеральный директор',
      description: 'Руководство компанией и стратегическое управление.',
      color: '#a3e635',
    },
  ];

  const byId = new Map();
  DEPARTMENTS.forEach((dep, idx) => {
    const id = dep.id + 100;
    byId.set(dep.id, id);
    nodes.push({
      id,
      name: dep.name,
      parentId: dep.parent ? dep.parent + 100 : 1,
      headName: dep.headName || '',
      headRole: dep.headRole || 'Руководитель отдела',
      description: '',
      color: dep.color || NODE_COLORS[idx % NODE_COLORS.length],
    });
  });

  const knownNames = new Set(nodes.map((n) => normalize(n.name)));
  let nextId = 1000;
  users
    .filter((u) => u.role !== 'intern')
    .forEach((u) => {
      const departmentName = u.department_name || u.department || '';
      if (!departmentName) return;

      if (!knownNames.has(normalize(departmentName))) {
        nodes.push({
          id: nextId,
          name: departmentName,
          parentId: 1,
          headName: '',
          headRole: 'Руководитель отдела',
          description: '',
          color: NODE_COLORS[nextId % NODE_COLORS.length],
        });
        knownNames.add(normalize(departmentName));
        nextId += 1;
      }
    });

  return nodes;
};

const getChildMap = (nodes) => {
  const map = new Map();
  nodes.forEach((node) => {
    const key = node.parentId || 0;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(node);
  });
  return map;
};

export default function Company() {
  const { mockUsers, user, isAdmin, isSuperAdmin, USE_MOCK } = useAuth();
  const [tab, setTab] = useState('structure');
  const [nodes, setNodes] = useState(() => createDefaultNodes(mockUsers));
  const [selectedId, setSelectedId] = useState(1);
  const [form, setForm] = useState({ name: '', parentId: '', headName: '', headRole: '', color: NODE_COLORS[0], description: '' });

  const canEditStructure = isAdmin || isSuperAdmin || user?.role === 'projectmanager';

  const employees = useMemo(() => mockUsers.filter((u) => u.role !== 'intern'), [mockUsers]);

  useEffect(() => {
    const loadStructure = async () => {
      if (!USE_MOCK) {
        try {
          const { data } = await orgStructureAPI.tree();
          const backendNodes = flattenTree(data);
          if (backendNodes.length) {
            setNodes(backendNodes);
            setSelectedId(backendNodes[0].id);
            return;
          }
        } catch (error) {
          console.warn('Не удалось загрузить структуру с backend, используем локальные данные.', error);
        }
      }

      try {
        const raw = localStorage.getItem(ORG_STORAGE_KEY);
        if (!raw) {
          const defaults = createDefaultNodes(mockUsers);
          setNodes(defaults);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setNodes(parsed);
        }
      } catch {
        setNodes(createDefaultNodes(mockUsers));
      }
    };
    loadStructure();
  }, [mockUsers, USE_MOCK]);

  useEffect(() => {
    if (!USE_MOCK) return;
    localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes, USE_MOCK]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const childMap = useMemo(() => getChildMap(nodes), [nodes]);
  const rootNodes = useMemo(() => childMap.get(0) || [], [childMap]);

  const selectedNode = useMemo(() => nodeMap.get(selectedId) || null, [nodeMap, selectedId]);

  useEffect(() => {
    if (!selectedNode) return;
    setForm({
      name: selectedNode.name || '',
      parentId: selectedNode.parentId == null ? '' : String(selectedNode.parentId),
      headName: selectedNode.headName || '',
      headRole: selectedNode.headRole || '',
      color: selectedNode.color || NODE_COLORS[0],
      description: selectedNode.description || '',
    });
  }, [selectedNode]);

  const departmentStats = useMemo(() => {
    const stats = new Map();

    nodes.forEach((node) => {
      const team = employees.filter((emp) => {
        const dep = normalize(emp.department_name || emp.department);
        const sub = normalize(emp.subdivision_name || emp.subdivision);
        const nodeName = normalize(node.name);
        return dep === nodeName || sub === nodeName;
      });
      stats.set(node.id, team);
    });

    return stats;
  }, [employees, nodes]);

  const isDescendant = (candidateId, nodeId) => {
    if (!candidateId || !nodeId) return false;
    const children = childMap.get(nodeId) || [];
    for (const child of children) {
      if (child.id === candidateId) return true;
      if (isDescendant(candidateId, child.id)) return true;
    }
    return false;
  };

  const handleSaveNode = async () => {
    if (!canEditStructure || !selectedNode) return;
    if (!form.name.trim()) return;

    const parentId = form.parentId === '' ? null : Number(form.parentId);
    if (parentId === selectedNode.id) return;
    if (parentId && isDescendant(parentId, selectedNode.id)) {
      window.alert('Нельзя выбрать дочерний узел как родителя. Это ломает структуру.');
      return;
    }
    const rootCount = nodes.filter((n) => n.parentId == null).length;
    if (selectedNode.parentId == null && parentId != null && rootCount <= 1) {
      window.alert('Нельзя убирать единственный корневой узел структуры.');
      return;
    }

    if (!USE_MOCK) {
      try {
        await orgStructureAPI.update(selectedNode.id, {
          name: form.name.trim(),
          parent: parentId,
          head_name: form.headName.trim(),
          head_role: form.headRole.trim(),
          color: form.color,
          description: form.description.trim(),
        });
      } catch (error) {
        window.alert(error?.response?.data?.detail || 'Ошибка сохранения на backend.');
        return;
      }
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              name: form.name.trim(),
              parentId,
              headName: form.headName.trim(),
              headRole: form.headRole.trim(),
              color: form.color,
              description: form.description.trim(),
            }
          : node
      )
    );
  };

  const handleCreateNode = async (parentId = null) => {
    if (!canEditStructure) return;
    const name = window.prompt('Название отдела / подразделения');
    if (!name || !name.trim()) return;

    if (!USE_MOCK) {
      try {
        const { data } = await orgStructureAPI.create({
          name: name.trim(),
          parent: parentId,
          head_name: '',
          head_role: 'Руководитель',
          description: '',
          color: NODE_COLORS[(nodes.length + 1) % NODE_COLORS.length],
          sort_order: 0,
          is_active: true,
        });
        const created = {
          id: data.id,
          name: data.name,
          parentId: data.parent,
          headName: data.head_name || '',
          headRole: data.head_role || '',
          description: data.description || '',
          color: data.color || NODE_COLORS[(nodes.length + 1) % NODE_COLORS.length],
          sortOrder: data.sort_order || 0,
          department: data.department || null,
          code: data.code || '',
        };
        setNodes((prev) => [...prev, created]);
        setSelectedId(created.id);
        return;
      } catch (error) {
        window.alert('Ошибка создания узла на backend.');
        return;
      }
    }

    const newId = Math.max(0, ...nodes.map((n) => n.id)) + 1;
    const newNode = {
      id: newId,
      name: name.trim(),
      parentId,
      headName: '',
      headRole: 'Руководитель',
      description: '',
      color: NODE_COLORS[newId % NODE_COLORS.length],
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedId(newId);
  };

  const handleDeleteNode = async () => {
    if (!canEditStructure || !selectedNode) return;
    if (selectedNode.parentId == null) return;

    const hasChildren = nodes.some((n) => n.parentId === selectedNode.id);
    if (hasChildren) {
      window.alert('Сначала удалите или перенесите вложенные подразделения.');
      return;
    }

    const ok = window.confirm(`Удалить: ${selectedNode.name}?`);
    if (!ok) return;

    if (!USE_MOCK) {
      try {
        await orgStructureAPI.delete(selectedNode.id);
      } catch (error) {
        window.alert('Ошибка удаления на backend.');
        return;
      }
    }

    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setSelectedId(1);
  };

  const handleSeedLargeStructure = async () => {
    if (!canEditStructure || USE_MOCK) return;
    try {
      await orgStructureAPI.seedLargeDemo();
      const { data } = await orgStructureAPI.tree();
      const backendNodes = flattenTree(data);
      setNodes(backendNodes);
      if (backendNodes[0]) setSelectedId(backendNodes[0].id);
    } catch (error) {
      window.alert('Не удалось заполнить большую структуру (возможно, она уже создана).');
    }
  };

  const handleResetStructure = () => {
    if (!canEditStructure) return;
    if (!USE_MOCK) {
      window.alert('Для backend-режима используйте ручное редактирование или кнопку "Заполнить большую структуру".');
      return;
    }
    const ok = window.confirm('Сбросить структуру к шаблону?');
    if (!ok) return;
    const defaults = createDefaultNodes(mockUsers);
    setNodes(defaults);
    setSelectedId(1);
  };

  const renderTreeNode = (node, isRoot = false) => {
    const children = childMap.get(node.id) || [];
    const team = departmentStats.get(node.id) || [];
    return (
      <div key={node.id} className={`company-tree-item ${isRoot ? 'is-root' : ''}`}>
        <div className="company-tree-node-shell">
          <button
            type="button"
            className={`company-node-card ${node.id === selectedId ? 'active' : ''}`}
            onClick={() => setSelectedId(node.id)}
            style={{ backgroundColor: node.color || '#f3f4f6' }}
          >
            <div className="company-node-title">{node.name}</div>
            <div className="company-node-head">{node.headName || 'Руководитель не указан'}</div>
            <div className="company-node-role">{node.headRole || '—'}</div>
            {node.description ? <div className="company-node-desc">{node.description}</div> : null}
            <div className="company-node-staff">Сотрудники: {team.length}</div>
            {team.length > 0 && (
              <div className="company-node-members">
                {team.slice(0, 4).map((person) => (
                  <span key={person.id}>{person.name}</span>
                ))}
              </div>
            )}
          </button>

          {canEditStructure && (
            <button type="button" className="company-node-add-btn" onClick={() => handleCreateNode(node.id)}>
              + Подотдел
            </button>
          )}
        </div>

        {children.length > 0 && (
          <div className={`company-tree-children ${children.length === 1 ? 'single' : ''}`}>
            {children.map((child) => (
              <div className="company-tree-child" key={child.id}>
                {renderTreeNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout title="Компания">
      <div className="page-header">
        <div>
          <div className="page-title">Компания</div>
          <div className="page-subtitle">Структура компании и сотрудники</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${tab === 'structure' ? 'active' : ''}`} onClick={() => setTab('structure')}>Структура</button>
        <button className={`tab-btn ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Сотрудники</button>
      </div>

      {tab === 'structure' && (
        <div className="card">
          <div className="card-header company-structure-head">
            <div>
              <span className="card-title">Структура компании "В ПЛЮСЕ"</span>
              <div className="text-sm text-muted mt-1">Редактируемый шаблон: уровни, отделы, руководители и подчиненность.</div>
            </div>
            {canEditStructure && (
              <div className="company-structure-actions">
                <button className="btn btn-outline" onClick={() => handleCreateNode(1)}>+ Добавить отдел</button>
                <button className="btn btn-outline" onClick={() => selectedNode && handleCreateNode(selectedNode.id)} disabled={!selectedNode}>+ Добавить подотдел</button>
                <button className="btn btn-ghost" onClick={handleResetStructure}>Сбросить</button>
                {!USE_MOCK && <button className="btn btn-primary" onClick={handleSeedLargeStructure}>Заполнить большую структуру</button>}
              </div>
            )}
          </div>

          <div className="card-body company-structure-layout">
            <div className="company-tree-scroll">
              <div className="company-tree-root">
                {rootNodes.map((node) => renderTreeNode(node, true))}
                {rootNodes.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">⚠️</div>
                    <div className="empty-title">Структура временно пустая</div>
                    <div className="empty-text">Не найден корневой узел. Выберите узел в редакторе и укажите родителя "Корень".</div>
                  </div>
                )}
              </div>
            </div>

            {canEditStructure && selectedNode && (
              <div className="company-editor card">
                <div className="card-header"><span className="card-title">Редактирование узла</span></div>
                <div className="card-body company-editor-grid">
                  <label className="field-block">
                    <span className="form-label">Название</span>
                    <input className="form-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </label>

                  <label className="field-block">
                    <span className="form-label">Родительский узел</span>
                    <select className="form-select" value={form.parentId} onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}>
                      <option value="">Корень</option>
                      {nodes
                        .filter((n) => n.id !== selectedNode.id)
                        .map((n) => (
                          <option value={String(n.id)} key={n.id}>{n.name}</option>
                        ))}
                    </select>
                  </label>

                  <label className="field-block">
                    <span className="form-label">Руководитель</span>
                    <input className="form-input" value={form.headName} onChange={(e) => setForm((prev) => ({ ...prev, headName: e.target.value }))} />
                  </label>

                  <label className="field-block">
                    <span className="form-label">Должность</span>
                    <input className="form-input" value={form.headRole} onChange={(e) => setForm((prev) => ({ ...prev, headRole: e.target.value }))} />
                  </label>

                  <label className="field-block">
                    <span className="form-label">Описание</span>
                    <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </label>

                  <label className="field-block">
                    <span className="form-label">Цвет блока</span>
                    <input className="form-input" type="color" value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
                  </label>

                  <div className="company-editor-actions">
                    <button className="btn btn-primary" onClick={handleSaveNode}>Сохранить</button>
                    <button className="btn btn-outline" onClick={() => handleCreateNode(selectedNode.id)}>+ Вложенный отдел</button>
                    <button className="btn btn-danger" onClick={handleDeleteNode} disabled={selectedNode.parentId == null}>Удалить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Сотрудники компании</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>СОТРУДНИК</th>
                  <th>ОТДЕЛ</th>
                  <th>ПОДРАЗДЕЛЕНИЕ</th>
                  <th>ДОЛЖНОСТЬ</th>
                  <th>РОЛЬ</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.department_name || u.department || '—'}</td>
                    <td>{u.subdivision_name || u.subdivision || '—'}</td>
                    <td>{u.position_name || u.position || '—'}</td>
                    <td>{u.roleLabel || u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
