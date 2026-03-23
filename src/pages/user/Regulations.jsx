import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import api from '../../api/axios';
import { regulationsAPI } from '../../api/content';
import { useAuth } from '../../context/AuthContext';

function toAbsoluteMedia(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function detectExt(url) {
  if (!url) return '';
  const clean = url.split('?')[0];
  const i = clean.lastIndexOf('.');
  if (i === -1) return '';
  return clean.slice(i + 1).toLowerCase();
}

export default function Regulations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [downloadBusyId, setDownloadBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const isAdminLike = ['admin', 'department_head', 'superadmin'].includes(String(user?.role || ''));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await regulationsAPI.list();
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(
          list.map((r) => {
            const content = toAbsoluteMedia(r.content);
            const ext = detectExt(content);
            return {
              id: r.id,
              title: r.title,
              description: r.description || '',
              type: r.type,
              content,
              ext,
            };
          })
        );
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => items.slice(), [items]);

  useEffect(() => {
    let isAlive = true;
    let objectUrl = '';

    const loadPreview = async () => {
      if (!selected?.id || selected?.type === 'link') {
        setPreviewUrl('');
        setPreviewError('');
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      setPreviewError('');
      setPreviewUrl('');
      try {
        const res = await api.get(`/v1/regulations/${selected.id}/download/`, { responseType: 'blob' });
        if (!isAlive) return;
        objectUrl = window.URL.createObjectURL(res.data);
        setPreviewUrl(objectUrl);
      } catch {
        if (!isAlive) return;
        setPreviewError('Не удалось загрузить предпросмотр. Используйте кнопку "Скачать".');
      } finally {
        if (isAlive) setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      isAlive = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [selected?.id]);

  const downloadRegulation = async (reg) => {
    if (!reg?.id || reg?.type !== 'file') return;
    setDownloadBusyId(reg.id);
    try {
      const res = await api.get(`/v1/regulations/${reg.id}/download/`, { responseType: 'blob' });
      const blob = res.data;
      const blobUrl = window.URL.createObjectURL(blob);
      const ext = reg.ext ? `.${reg.ext}` : '';
      const filename = `${reg.title || 'regulation'}${ext}`.replace(/[\\/:*?"<>|]+/g, '_');
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } finally {
      setDownloadBusyId(null);
    }
  };

  return (
    <MainLayout title="Регламенты компании">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-title">Внутренние регламенты и инструкции</div>
          <div className="page-subtitle">Список документов из backend</div>
        </div>
        {isAdminLike && (
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => navigate('/admin/content?tab=regulations')}
          >
            Редактор регламентов
          </button>
        )}
      </div>

      {loading ? (
        <div className="card"><div className="card-body">Загрузка...</div></div>
      ) : (
        <div className="reg-grid">
          {sorted.map((reg) => (
            <div key={reg.id} className="reg-card">
              <div className="reg-title">{reg.title}</div>
              <div className="reg-action" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={() => {
                    if (reg.type === 'link' && reg.content) {
                      window.open(reg.content, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    setSelected(reg);
                  }}
                >
                  <ExternalLink size={13} /> Подробнее
                </button>
                {reg.type === 'file' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => downloadRegulation(reg)}
                    disabled={downloadBusyId === reg.id}
                  >
                    <Download size={13} /> Скачать
                  </button>
                )}
              </div>
            </div>
          ))}
          {sorted.length === 0 ? (
            <div className="card"><div className="card-body">Регламентов пока нет.</div></div>
          ) : null}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 980, width: 'calc(100vw - 32px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <button className="btn-icon" type="button" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {previewLoading ? (
                <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>Загрузка предпросмотра...</div>
              ) : previewUrl ? (
                <iframe
                  title={selected.title}
                  src={previewUrl}
                  style={{ width: '100%', height: '65vh', border: '1px solid var(--gray-200)', borderRadius: '10px' }}
                />
              ) : previewError ? (
                <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>{previewError}</div>
              ) : (
                <div
                  style={{
                    maxHeight: '65vh',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    border: '1px solid var(--gray-200)',
                    borderRadius: '10px',
                    padding: 12,
                  }}
                >
                  {selected.description || 'Нет содержимого.'}
                </div>
              )}
            </div>
            {selected.type === 'file' && selected.content && (
              <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => downloadRegulation(selected)}
                  disabled={downloadBusyId === selected.id}
                >
                  <Download size={13} /> Скачать
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}



