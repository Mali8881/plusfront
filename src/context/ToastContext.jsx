import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Слушаем события от axios (вне React-дерева)
  useEffect(() => {
    const handler = (e) => showToast(e.detail.message, e.detail.type, e.detail.duration);
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`toast toast-${t.type}`}
              onClick={() => dismiss(t.id)}
              role="alert"
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// Утилита для вызова тостов вне React (из axios и т.п.)
export function dispatchToast(message, type = 'error', duration = 4000) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, duration } }));
}
