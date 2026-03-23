import { useEffect, useMemo, useRef, useState } from 'react';

const YOUTUBE_API_SRC = 'https://www.youtube.com/iframe_api';

let youTubeApiPromise = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubeApiPromise) return youTubeApiPromise;

  youTubeApiPromise = new Promise((resolve, reject) => {
    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousHandler === 'function') previousHandler();
      resolve(window.YT);
    };

    const existing = document.querySelector(`script[src="${YOUTUBE_API_SRC}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.src = YOUTUBE_API_SRC;
      script.async = true;
      script.onerror = () => reject(new Error('Не удалось загрузить YouTube API.'));
      document.body.appendChild(script);
    }

    window.setTimeout(() => {
      if (!window.YT?.Player) {
        reject(new Error('YouTube API не ответил вовремя.'));
      }
    }, 10000);
  });

  return youTubeApiPromise;
}

function formatSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getYouTubeVideoId(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').trim();
    }
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      }
      return parsed.searchParams.get('v') || '';
    }
  } catch {
    return '';
  }
  return '';
}

function isFileVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(String(url || ''));
}

export function isLockedVideoCandidate(url) {
  return Boolean(getYouTubeVideoId(url) || isFileVideoUrl(url));
}

export default function LockedVideoPlayer({ src, title = 'Видео' }) {
  const containerRef = useRef(null);
  const htmlVideoRef = useRef(null);
  const playerRef = useRef(null);
  const monitorRef = useRef(null);
  const maxWatchedRef = useRef(0);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxWatched, setMaxWatched] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const youTubeVideoId = useMemo(() => getYouTubeVideoId(src), [src]);
  const sourceKind = useMemo(() => {
    if (youTubeVideoId) return 'youtube';
    if (isFileVideoUrl(src)) return 'file';
    return 'unsupported';
  }, [src, youTubeVideoId]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const watchedProgress = duration > 0 ? Math.min(100, (maxWatched / duration) * 100) : 0;

  const clearHint = () => {
    window.clearTimeout(clearHint._id);
    clearHint._id = window.setTimeout(() => setHint(''), 1800);
  };

  const showForwardSeekHint = () => {
    setHint('Перемотка вперед заблокирована. Сначала досмотрите предыдущую часть.');
    clearHint();
  };

  useEffect(() => {
    maxWatchedRef.current = 0;
    setDuration(0);
    setCurrentTime(0);
    setMaxWatched(0);
    setHint('');
    setError('');
  }, [src]);

  useEffect(() => {
    if (sourceKind !== 'youtube' || !containerRef.current || !youTubeVideoId) return undefined;

    let cancelled = false;

    const stopMonitor = () => {
      if (monitorRef.current) {
        window.clearInterval(monitorRef.current);
        monitorRef.current = null;
      }
    };

    const startMonitor = () => {
      stopMonitor();
      monitorRef.current = window.setInterval(() => {
        if (!playerRef.current) return;
        const player = playerRef.current;
        const nextTime = Number(player.getCurrentTime?.() || 0);
        const nextDuration = Number(player.getDuration?.() || 0);
        if (nextDuration > 0) setDuration(nextDuration);
        if (nextTime > maxWatchedRef.current + 1.25) {
          player.seekTo(maxWatchedRef.current, true);
          showForwardSeekHint();
          return;
        }
        setCurrentTime(nextTime);
        if (nextTime > maxWatchedRef.current) {
          maxWatchedRef.current = nextTime;
          setMaxWatched(nextTime);
        }
      }, 400);
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId: youTubeVideoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              setDuration(Number(event.target.getDuration?.() || 0));
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                startMonitor();
              } else if (event.data === YT.PlayerState.ENDED) {
                stopMonitor();
                const finalDuration = Number(event.target.getDuration?.() || 0);
                setCurrentTime(finalDuration);
                maxWatchedRef.current = finalDuration;
                setMaxWatched(finalDuration);
              } else {
                stopMonitor();
              }
            },
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Не удалось загрузить видеоплеер.');
        }
      });

    return () => {
      cancelled = true;
      stopMonitor();
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
    };
  }, [sourceKind, youTubeVideoId]);

  const handleHtmlTimeUpdate = () => {
    const video = htmlVideoRef.current;
    if (!video) return;
    const nextTime = Number(video.currentTime || 0);
    const nextDuration = Number(video.duration || 0);
    if (nextDuration > 0) setDuration(nextDuration);
    setCurrentTime(nextTime);
    if (nextTime > maxWatchedRef.current) {
      maxWatchedRef.current = nextTime;
      setMaxWatched(nextTime);
    }
  };

  const handleHtmlSeeking = () => {
    const video = htmlVideoRef.current;
    if (!video) return;
    if (video.currentTime > maxWatchedRef.current + 0.75) {
      video.currentTime = maxWatchedRef.current;
      showForwardSeekHint();
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--gray-600)' }}>
        <div><strong>{title}</strong></div>
        <div>Просмотрено: {formatSeconds(maxWatched)} / {formatSeconds(duration)}</div>
      </div>

      {sourceKind === 'youtube' ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0f172a',
          }}
        >
          <div
            ref={containerRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
      ) : null}

      {sourceKind === 'file' ? (
        <video
          ref={htmlVideoRef}
          src={src}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onLoadedMetadata={handleHtmlTimeUpdate}
          onTimeUpdate={handleHtmlTimeUpdate}
          onSeeking={handleHtmlSeeking}
          style={{ width: '100%', borderRadius: 12, background: '#0f172a' }}
        />
      ) : null}

      {sourceKind === 'unsupported' ? (
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--gray-200)', background: 'var(--gray-50)', color: 'var(--gray-600)', lineHeight: 1.55 }}>
          Для этого источника нельзя надежно заблокировать перемотку вперед во встроенном плеере.
          Откройте материал в новой вкладке или загрузите YouTube / MP4-ссылку.
        </div>
      ) : null}

      <div style={{ height: 8, borderRadius: 999, background: 'var(--gray-100)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${watchedProgress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--gray-500)' }}>
        <span>Текущее время: {formatSeconds(currentTime)}</span>
        <span>Доступно до: {formatSeconds(maxWatched)}</span>
      </div>

      {hint ? (
        <div style={{ padding: 10, borderRadius: 12, background: '#fff7ed', color: '#9a3412', fontSize: 13 }}>
          {hint}
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 10, borderRadius: 12, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
