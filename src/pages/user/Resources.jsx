import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Trash2, X, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { resourcesAPI } from '../../api/resources';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isInternRole } from '../../utils/roles';

function toYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtTime(isoOrHHMM) {
  if (!isoOrHHMM) return '—';
  if (isoOrHHMM.includes('T')) {
    return new Date(isoOrHHMM).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return isoOrHHMM.slice(0, 5);
}

function typeLabel(type) {
  if (type === 'desk') return 'Рабочее место';
  if (type === 'meeting_room') return 'Переговорка';
  return type || '—';
}

function badgeClass(status) {
  if (status === 'active') return 'badge-green';
  if (status === 'maintenance') return 'badge-yellow';
  return 'badge-gray';
}

function statusLabel(status) {
  if (status === 'active') return 'Активен';
  if (status === 'maintenance') return 'На обслуживании';
  if (status === 'disabled') return 'Выключен';
  return status || '—';
}

// ── Booking modal for meeting rooms ──────────────────────────────────────────

function RoomBookingModal({ slot, roomName, date, purposes, participants, onConfirm, onClose, busy }) {
  const [purpose, setPurpose] = useState(purposes[0]?.value || '');
  const [selected, setSelected] = useState([]);

  const toggleParticipant = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 0 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Забронировать переговорку</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={14} />
          </button>
        </div>
        <div className="card-body" style={{ overflowY: 'auto', display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Переговорная</div>
              <div style={{ fontWeight: 600 }}>{roomName}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Дата</div>
              <div style={{ fontWeight: 600 }}>{date}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Начало</div>
              <div style={{ fontWeight: 600 }}>{fmtTime(slot.starts_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Конец</div>
              <div style={{ fontWeight: 600 }}>{fmtTime(slot.ends_at)}</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Цель встречи</label>
            <select className="form-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {purposes.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {participants.length > 0 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                <Users size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Участники ({selected.length} выбрано)
              </label>
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                {participants.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 12px', cursor: 'pointer',
                      borderBottom: '1px solid var(--gray-100)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggleParticipant(p.id)}
                    />
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 'auto' }}>{p.role_label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onClose} disabled={busy}>Отмена</button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy || !purpose}
            onClick={() => onConfirm({ purpose, participant_ids: selected })}
          >
            {busy ? 'Бронируем...' : 'Забронировать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Resources() {
  const { user } = useAuth();
  const isIntern = isInternRole(user?.role);
  const isAdminLike = isAdminRole(user?.role);
  const location = useLocation();
  const bookingsRef = useRef(null);

  const [resources, setResources] = useState([]);
  const [resourceType, setResourceType] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [date, setDate] = useState(toYmd(new Date()));
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Room options (loaded once on mount)
  const [roomOptions, setRoomOptions] = useState(null);

  // Booking modal
  const [bookingModal, setBookingModal] = useState(null); // { slot }
  const [modalBusy, setModalBusy] = useState(false);

  // Admin: create room
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const focusBookings = useMemo(() => {
    const query = new URLSearchParams(location.search || '');
    return query.get('focus') === 'bookings';
  }, [location.search]);

  const isRoomSelected = useMemo(() => String(selectedResourceId).startsWith('room-'), [selectedResourceId]);

  const filteredResources = useMemo(() => {
    if (!resourceType) return resources;
    return resources.filter((item) => String(item.resource_type) === resourceType);
  }, [resources, resourceType]);

  const selectedResource = useMemo(
    () => filteredResources.find((item) => item.id === selectedResourceId) || null,
    [filteredResources, selectedResourceId]
  );

  const mapBounds = useMemo(() => {
    if (!filteredResources.length) return null;
    const lats = filteredResources.map((r) => Number(r.latitude));
    const lons = filteredResources.map((r) => Number(r.longitude));
    return {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLon: Math.min(...lons), maxLon: Math.max(...lons),
    };
  }, [filteredResources]);

  const markerStyle = (resource) => {
    if (!mapBounds) return { left: '50%', top: '50%' };
    const lonSpan = Math.max(0.0001, mapBounds.maxLon - mapBounds.minLon);
    const latSpan = Math.max(0.0001, mapBounds.maxLat - mapBounds.minLat);
    const x = ((Number(resource.longitude) - mapBounds.minLon) / lonSpan) * 100;
    const y = ((mapBounds.maxLat - Number(resource.latitude)) / latSpan) * 100;
    return {
      left: `${Math.min(97, Math.max(3, x))}%`,
      top: `${Math.min(97, Math.max(3, y))}%`,
    };
  };

  const refreshResources = async () => {
    const res = await resourcesAPI.list();
    const rows = Array.isArray(res.data) ? res.data : [];
    setResources(rows);
    setSelectedResourceId((prev) => {
      if (prev && rows.some((item) => item.id === prev)) return prev;
      return rows[0]?.id || '';
    });
  };

  const refreshSelectedData = async (resourceId) => {
    if (!resourceId) { setSlots([]); setBookings([]); return; }
    const [slotsRes, bookingsRes] = await Promise.all([
      resourcesAPI.freeSlots(resourceId, { date, slot_minutes: 60, work_start: '09:00', work_end: '18:00' }),
      resourcesAPI.bookings(resourceId, { date }),
    ]);
    setSlots(Array.isArray(slotsRes.data?.slots) ? slotsRes.data.slots : []);
    setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
  };

  // Load room options on mount
  useEffect(() => {
    resourcesAPI.roomOptions()
      .then((res) => setRoomOptions(res.data))
      .catch(() => setRoomOptions(null));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        await refreshResources();
      } catch (e) {
        setError(e?.response?.data?.detail || 'Не удалось загрузить ресурсы.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setError('');
      try {
        await refreshSelectedData(selectedResourceId);
      } catch {
        setSlots([]);
        setBookings([]);
      }
    })();
  }, [selectedResourceId, date]);

  useEffect(() => {
    setSelectedResourceId((prev) => {
      if (!filteredResources.length) return '';
      if (prev && filteredResources.some((item) => item.id === prev)) return prev;
      return filteredResources[0]?.id || '';
    });
  }, [filteredResources]);

  useEffect(() => {
    if (!focusBookings || loading) return;
    bookingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusBookings, loading, selectedResourceId, bookings.length]);

  // Desk booking (direct, no modal)
  const createDeskBooking = async (slot) => {
    if (!selectedResourceId || busyAction || isIntern) return;
    setBusyAction(true);
    setError('');
    try {
      await resourcesAPI.createBooking(selectedResourceId, { starts_at: slot.starts_at, ends_at: slot.ends_at });
      await refreshSelectedData(selectedResourceId);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось создать бронь.');
    } finally {
      setBusyAction(false);
    }
  };

  // Room booking (via modal)
  const handleSlotClick = (slot) => {
    if (isRoomSelected) {
      if (roomOptions?.booking_allowed === false) {
        setError(roomOptions?.booking_message || 'Бронирование переговорок недоступно для вашей роли.');
        return;
      }
      setBookingModal({ slot });
    } else {
      createDeskBooking(slot);
    }
  };

  const confirmRoomBooking = async ({ purpose, participant_ids }) => {
    if (!bookingModal || !selectedResourceId) return;
    setModalBusy(true);
    setError('');
    try {
      await resourcesAPI.createBooking(selectedResourceId, {
        starts_at: bookingModal.slot.starts_at,
        ends_at: bookingModal.slot.ends_at,
        purpose,
        participant_ids,
      });
      setBookingModal(null);
      await refreshSelectedData(selectedResourceId);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось создать бронь.');
    } finally {
      setModalBusy(false);
    }
  };

  const removeBooking = async (bookingId) => {
    if (!bookingId || busyAction) return;
    setBusyAction(true);
    setError('');
    try {
      await resourcesAPI.deleteBooking(bookingId, selectedResourceId);
      await refreshSelectedData(selectedResourceId);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось удалить бронь.');
    } finally {
      setBusyAction(false);
    }
  };

  const createRoom = async () => {
    const name = String(newRoomName || '').trim();
    if (!name || creatingRoom) return;
    setCreatingRoom(true);
    setError('');
    try {
      await resourcesAPI.createRoom(name);
      setShowCreateRoom(false);
      setNewRoomName('');
      await refreshResources();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось создать переговорку.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const deleteRoom = async (rawRoomId) => {
    if (busyAction) return;
    setBusyAction(true);
    setError('');
    try {
      await resourcesAPI.deleteRoom(rawRoomId);
      await refreshResources();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось удалить переговорку.');
    } finally {
      setBusyAction(false);
    }
  };

  const canBookRoom = !isIntern && (roomOptions === null || roomOptions?.booking_allowed !== false);
  const canManageRooms = roomOptions?.room_create_allowed === true;

  return (
    <MainLayout title="Ресурсы">
      {bookingModal && (
        <RoomBookingModal
          slot={bookingModal.slot}
          roomName={selectedResource?.name || ''}
          date={date}
          purposes={roomOptions?.purposes || []}
          participants={roomOptions?.participants || []}
          onConfirm={confirmRoomBooking}
          onClose={() => setBookingModal(null)}
          busy={modalBusy}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Карта ресурсов и бронирование</div>
          <div className="page-subtitle">Выберите ресурс, дату и свободный слот</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setError('')}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="card-body">Загрузка...</div></div>
      ) : (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ display: 'grid', gap: 10, gridTemplateColumns: '220px 1fr 220px' }}>
              <select className="form-select" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                <option value="">Все типы</option>
                <option value="desk">Рабочие места</option>
                <option value="meeting_room">Переговорки</option>
              </select>
              <select className="form-select" value={selectedResourceId} onChange={(e) => setSelectedResourceId(e.target.value)}>
                {filteredResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} · {typeLabel(resource.resource_type)}
                  </option>
                ))}
              </select>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {/* Admin: meeting room management */}
          {canManageRooms && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header">
                <span className="card-title">Управление переговорками</span>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowCreateRoom((v) => !v)}>
                  {showCreateRoom ? 'Скрыть' : 'Добавить переговорку'}
                </button>
              </div>
              {showCreateRoom && (
                <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="Название переговорки"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    style={{ maxWidth: 320 }}
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    disabled={creatingRoom || !String(newRoomName || '').trim()}
                    onClick={createRoom}
                  >
                    {creatingRoom ? 'Создаем...' : 'Создать'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            {/* Left: map + table */}
            <div className="card">
              <div className="card-header"><span className="card-title">Карта ресурсов</span></div>
              <div className="card-body">
                <div style={{ position: 'relative', height: 320, borderRadius: 10, border: '1px solid var(--gray-200)', background: 'linear-gradient(145deg, #EFF6FF, #F8FAFC)' }}>
                  {filteredResources.map((resource) => {
                    const isSelected = resource.id === selectedResourceId;
                    return (
                      <button
                        key={resource.id}
                        type="button"
                        onClick={() => setSelectedResourceId(resource.id)}
                        title={`${resource.name} (${typeLabel(resource.resource_type)})`}
                        style={{ position: 'absolute', transform: 'translate(-50%, -100%)', background: 'transparent', border: 'none', cursor: 'pointer', ...markerStyle(resource) }}
                      >
                        <MapPin size={isSelected ? 28 : 22} color={isSelected ? '#0EA5E9' : '#475569'} fill={isSelected ? '#BAE6FD' : '#CBD5E1'} />
                      </button>
                    );
                  })}
                  {filteredResources.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-500)' }}>
                      Нет ресурсов выбранного типа
                    </div>
                  )}
                </div>

                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        {canManageRooms && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResources.map((resource) => (
                        <tr key={resource.id} style={resource.id === selectedResourceId ? { background: '#F0F9FF' } : undefined}>
                          <td>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: resource.id === selectedResourceId ? 600 : 400, color: 'inherit', padding: 0 }}
                              onClick={() => setSelectedResourceId(resource.id)}
                            >
                              {resource.name}
                            </button>
                          </td>
                          <td>{typeLabel(resource.resource_type)}</td>
                          <td><span className={`badge ${badgeClass(resource.status)}`}>{statusLabel(resource.status)}</span></td>
                          {canManageRooms && (
                            <td style={{ width: 44 }}>
                              {resource.resource_type === 'meeting_room' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  type="button"
                                  disabled={busyAction}
                                  title="Удалить переговорку"
                                  onClick={() => deleteRoom(resource.raw_id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredResources.length === 0 && (
                        <tr><td colSpan={canManageRooms ? 4 : 3}>Ресурсов нет.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: slots + bookings */}
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              {/* Free slots */}
              <div className="card" ref={bookingsRef}>
                <div className="card-header"><span className="card-title">Свободные слоты</span></div>
                <div className="card-body">
                  {!selectedResource ? (
                    <div style={{ color: 'var(--gray-500)' }}>Ресурс не выбран.</div>
                  ) : isRoomSelected && !canBookRoom ? (
                    <div style={{ color: 'var(--gray-500)' }}>
                      {roomOptions?.booking_message || 'Бронирование переговорок недоступно для вашей роли.'}
                    </div>
                  ) : slots.length === 0 ? (
                    <div style={{ color: 'var(--gray-500)' }}>Свободных слотов нет.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                      {slots.map((slot, idx) => (
                        <button
                          key={`${slot.starts_at}-${slot.ends_at}-${idx}`}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busyAction || isIntern || (isRoomSelected && !canBookRoom)}
                          onClick={() => handleSlotClick(slot)}
                        >
                          {fmtTime(slot.starts_at)} – {fmtTime(slot.ends_at)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bookings */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">{isRoomSelected ? 'Брони на день' : 'Мои брони'}</span>
                </div>

                {isRoomSelected ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Цель</th>
                          <th>Кто забронировал</th>
                          <th>Участники</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => (
                          <tr key={booking.id} style={booking.booked_by_me ? { background: '#F0FDF4' } : undefined}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
                            </td>
                            <td>{booking.purpose_label || booking.purpose || '—'}</td>
                            <td>
                              {booking.booked_by?.name || '—'}
                              {booking.booked_by_me && <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 4 }}>(вы)</span>}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                              {Array.isArray(booking.participants) && booking.participants.length > 0
                                ? booking.participants.map((p) => p.name).join(', ')
                                : '—'}
                            </td>
                            <td style={{ width: 44 }}>
                              {(booking.booked_by_me || isAdminLike) && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() => removeBooking(booking.id)}
                                  title="Отменить бронь"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {bookings.length === 0 && (
                          <tr><td colSpan={5}>Броней нет.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Начало</th>
                          <th>Конец</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => (
                          <tr key={booking.id}>
                            <td>{booking.starts_at ? new Date(booking.starts_at).toLocaleString('ru-RU') : fmtTime(booking.start_time)}</td>
                            <td>{booking.ends_at ? new Date(booking.ends_at).toLocaleString('ru-RU') : fmtTime(booking.end_time)}</td>
                            <td style={{ width: 56 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                type="button"
                                disabled={busyAction}
                                onClick={() => removeBooking(booking.id)}
                                title="Удалить бронь"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {bookings.length === 0 && (
                          <tr><td colSpan={3}>Броней нет.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
