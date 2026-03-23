import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { desksAPI } from '../../api/content';
import { useAuth } from '../../context/AuthContext';

const ROOM_ROLES = new Set(['projectmanager', 'department_head', 'admin', 'superadmin']);
const MAX_DESKS_PER_SIDE = 8;

const toLocalDateInput = (value = new Date()) => {
  const tzOffset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - tzOffset).toISOString().slice(0, 10);
};

const formatTimeRange = (start, end) => (!start || !end ? 'Время не указано' : `${start} - ${end}`);
const slotKey = (slot) => `${slot.start_time}-${slot.end_time}`;
const slotDuration = (slot) => `${slot.duration_minutes} мин`;
const buildBookingsTitle = (bookings = []) => {
  if (!bookings.length) return 'На выбранную дату место свободно';
  return bookings
    .map((booking) => `${booking.start_time}-${booking.end_time}: ${booking.booked_by_me ? 'Вы' : booking.booked_by?.name || 'Занято'}`)
    .join('\n');
};
const addMinutes = (timeValue, minutes) => {
  const [h, m] = String(timeValue || '00:00').split(':').map(Number);
  const total = (h * 60 + m) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const clampEnd = (start, end, minutes) => {
  const candidate = addMinutes(start, minutes);
  return !candidate || candidate > end ? end : candidate;
};
const buildDeskSlots = (items, side) => {
  const prefix = side === 'left' ? 'A' : 'B';
  const byRow = new Map(items.map((item) => [Number(item.row), item]));

  return Array.from({ length: MAX_DESKS_PER_SIDE }, (_, index) => {
    const row = index + 1;
    return byRow.get(row) || {
      id: `${side}-placeholder-${row}`,
      code: `${prefix}${row}`,
      side,
      row,
      is_placeholder: true,
      is_available: false,
      bookings: [],
    };
  });
};

function DeskModal({ desk, onClose, onBook, onCancel, canBook, isBusy }) {
  if (!desk) return null;
  const bookings = Array.isArray(desk.bookings) ? desk.bookings : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: 'calc(100vw - 32px)' }}>
        <div className="modal-header">
          <div className="modal-title">{`Место ${desk.code}`}</div>
          <button className="btn-icon" type="button" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
            Ниже показано, кто и на какое время занял это место.
          </div>
          {bookings.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bookings.map((booking) => (
                <div key={booking.id} style={{ border: `1px solid ${booking.booked_by_me ? '#93c5fd' : 'var(--gray-200)'}`, background: booking.booked_by_me ? '#eff6ff' : '#fff', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{`С ${booking.start_time} до ${booking.end_time}`}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>
                    {booking.booked_by_me ? 'Забронировано вами' : booking.booked_by?.name || 'Пользователь не указан'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 14, background: 'var(--gray-50)', color: '#166534', fontWeight: 600 }}>
              На выбранную дату это место пока свободно.
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Закрыть</button>
          {desk.booked_by_me ? (
            <button className="btn btn-outline" type="button" onClick={onCancel} disabled={isBusy}>Отменить бронь</button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onBook} disabled={!canBook || isBusy}>Забронировать по графику</button>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomModal({ room, options, selectedDate, onClose, onBook, onCancel, onDeleteRoom, isBusy, bookingMessage, canManageRooms }) {
  const bookings = Array.isArray(room?.bookings) ? room.bookings : [];
  const freeSlots = Array.isArray(room?.free_slots) ? room.free_slots : [];
  const purposes = Array.isArray(options?.purposes) ? options.purposes : [];
  const participants = Array.isArray(options?.participants) ? options.participants : [];
  const defaultDuration = Number(options?.default_duration_minutes || 30);
  const canBook = options?.booking_allowed === true;

  const [chosenSlotKey, setChosenSlotKey] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [participantIds, setParticipantIds] = useState([]);
  const [formError, setFormError] = useState('');

  const chosenSlot = useMemo(() => freeSlots.find((slot) => slotKey(slot) === chosenSlotKey) || null, [freeSlots, chosenSlotKey]);

  useEffect(() => {
    const initialSlot = freeSlots[0] || null;
    setPurpose(purposes[0]?.value || '');
    setParticipantIds([]);
    setFormError('');
    if (!initialSlot) {
      setChosenSlotKey('');
      setStartTime('');
      setEndTime('');
      return;
    }
    setChosenSlotKey(slotKey(initialSlot));
    setStartTime(initialSlot.start_time);
    setEndTime(clampEnd(initialSlot.start_time, initialSlot.end_time, defaultDuration));
  }, [room?.id, freeSlots, purposes, defaultDuration]);

  if (!room) return null;

  const submit = () => {
    if (!canBook) return setFormError(bookingMessage || 'Бронирование переговорных недоступно.');
    if (!chosenSlot) return setFormError('Сначала выберите свободное окно.');
    if (!purpose) return setFormError('Выберите цель встречи.');
    if (!startTime || !endTime || endTime <= startTime) return setFormError('Укажите корректное время.');
    if (startTime < chosenSlot.start_time || endTime > chosenSlot.end_time) {
      return setFormError(`Можно бронировать только внутри окна ${chosenSlot.start_time} - ${chosenSlot.end_time}.`);
    }
    onBook({
      room_id: room.id,
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      purpose,
      participant_ids: participantIds,
    });
  };

  const removeRoom = () => {
    if (!room || !canManageRooms || isBusy) return;
    const confirmed = window.confirm(`Удалить переговорную "${room.name}"? Комната исчезнет из списка, если у неё нет будущих броней.`);
    if (!confirmed) return;
    onDeleteRoom(room.id);
  };

  const toggleParticipant = (id) => {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: 'calc(100vw - 32px)' }}>
        <div className="modal-header">
          <div className="modal-title">{room.name}</div>
          <button className="btn-icon" type="button" onClick={onClose}>x</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
            Выберите свободное окно, цель встречи и сотрудников ниже по роли.
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Свободные окна</div>
            {freeSlots.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {freeSlots.map((slot) => (
                  <button key={slotKey(slot)} type="button" className={slotKey(slot) === chosenSlotKey ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => {
                    setChosenSlotKey(slotKey(slot));
                    setStartTime(slot.start_time);
                    setEndTime(clampEnd(slot.start_time, slot.end_time, defaultDuration));
                    setFormError('');
                  }}>
                    {slot.start_time} - {slot.end_time} ({slotDuration(slot)})
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 12, background: '#fef2f2', color: '#b91c1c' }}>
                На эту дату свободных окон нет.
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>Начало</div>
              <input type="time" step={300} className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!chosenSlot} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>Конец</div>
              <input type="time" step={300} className="form-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!chosenSlot} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>Цель брони</div>
              <select className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {purposes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Участники</div>
            {participants.length ? (
              <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {participants.map((participant) => (
                  <label key={participant.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={participantIds.includes(participant.id)} onChange={() => toggleParticipant(participant.id)} />
                    <span style={{ fontSize: 14 }}>{participant.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{participant.role_label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 12, color: 'var(--gray-500)' }}>
                Для вашей роли доступных сотрудников не найдено.
              </div>
            )}
          </div>
          {(formError || bookingMessage) && <div style={{ fontSize: 13, color: '#b91c1c' }}>{formError || bookingMessage}</div>}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Занято на эту дату</div>
            {bookings.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bookings.map((booking) => (
                  <div key={booking.id} style={{ border: `1px solid ${booking.booked_by_me ? '#93c5fd' : 'var(--gray-200)'}`, background: booking.booked_by_me ? '#eff6ff' : '#fff', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{`С ${booking.start_time} до ${booking.end_time}`}</div>
                        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>
                          {booking.booked_by_me ? 'Забронировано вами' : booking.booked_by?.name || 'Пользователь не указан'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{booking.purpose_label}</div>
                        {!!booking.participants?.length && (
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                            Участники: {booking.participants.map((item) => item.name).join(', ')}
                          </div>
                        )}
                      </div>
                      {booking.booked_by_me && <button className="btn btn-outline btn-sm" type="button" onClick={() => onCancel(booking.id)} disabled={isBusy}>Отменить</button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 14, background: 'var(--gray-50)', color: '#166534', fontWeight: 600 }}>
                На выбранную дату переговорная пока свободна.
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" type="button" onClick={onClose}>Закрыть</button>
            {canManageRooms && <button className="btn btn-outline" type="button" onClick={removeRoom} disabled={isBusy}>Удалить переговорную</button>}
          </div>
          <button className="btn btn-primary" type="button" onClick={submit} disabled={!canBook || !chosenSlot || isBusy}>Забронировать переговорную</button>
        </div>
      </div>
    </div>
  );
}

function CreateRoomModal({ open, onClose, onCreate, isBusy, createMessage }) {
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setFormError('');
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const normalized = String(name || '').trim();
    if (!normalized) {
      setFormError('Введите название переговорной.');
      return;
    }
    setFormError('');
    onCreate({ name: normalized });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: 'calc(100vw - 32px)' }}>
        <div className="modal-header">
          <div className="modal-title">Новая переговорная</div>
          <button className="btn-icon" type="button" onClick={onClose}>x</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
            Создайте новую комнату, и она сразу появится в списке доступных переговорных.
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>Название</div>
            <input
              type="text"
              className="form-input"
              placeholder="Например, Переговорная 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={isBusy}
            />
          </div>
          {(formError || createMessage) && <div style={{ fontSize: 13, color: '#b91c1c' }}>{formError || createMessage}</div>}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isBusy}>Закрыть</button>
          <button className="btn btn-primary" type="button" onClick={submit} disabled={isBusy}>Добавить переговорную</button>
        </div>
      </div>
    </div>
  );
}

export default function DeskBooking() {
  const { user } = useAuth();
  const canUseRooms = ROOM_ROLES.has(String(user?.role || '').toLowerCase());
  const [selectedDate, setSelectedDate] = useState(toLocalDateInput());
  const [activeTab, setActiveTab] = useState('desks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [desks, setDesks] = useState([]);
  const [deskStats, setDeskStats] = useState({ total: 0, available: 0, occupied: 0 });
  const [isDeskBookingAllowed, setIsDeskBookingAllowed] = useState(true);
  const [deskBookingReason, setDeskBookingReason] = useState('');
  const [deskBookingMessage, setDeskBookingMessage] = useState('');
  const [userShift, setUserShift] = useState(null);
  const [myDeskBooking, setMyDeskBooking] = useState(null);
  const [selectedDeskId, setSelectedDeskId] = useState(null);
  const [busyDeskId, setBusyDeskId] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [roomStats, setRoomStats] = useState({ total: 0, available: 0, occupied: 0 });
  const [roomOptions, setRoomOptions] = useState({
    booking_allowed: false,
    booking_message: '',
    room_create_allowed: false,
    room_create_message: '',
    default_duration_minutes: 30,
    purposes: [],
    participants: [],
  });
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [busyRoomId, setBusyRoomId] = useState(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const requests = [desksAPI.availability({ date: selectedDate })];
      if (canUseRooms) {
        requests.push(desksAPI.roomsAvailability({ date: selectedDate }));
        requests.push(desksAPI.roomOptions());
      }
      const [deskResponse, roomResponse, optionsResponse] = await Promise.all(requests);
      const deskPayload = deskResponse?.data || {};
      setDesks(Array.isArray(deskPayload.desks) ? deskPayload.desks : []);
      setDeskStats({ total: Number(deskPayload.total || 0), available: Number(deskPayload.available || 0), occupied: Number(deskPayload.occupied || 0) });
      setIsDeskBookingAllowed(deskPayload.booking_allowed !== false);
      setDeskBookingReason(deskPayload.booking_reason || '');
      setDeskBookingMessage(deskPayload.booking_message || '');
      setUserShift(deskPayload.user_shift || null);
      setMyDeskBooking(deskPayload.my_booking || null);

      if (canUseRooms) {
        const roomPayload = roomResponse?.data || {};
        setRooms(Array.isArray(roomPayload.rooms) ? roomPayload.rooms : []);
        setRoomStats({ total: Number(roomPayload.total || 0), available: Number(roomPayload.available || 0), occupied: Number(roomPayload.occupied || 0) });
        setRoomOptions(optionsResponse?.data || {});
      } else {
        setRooms([]);
        setRoomStats({ total: 0, available: 0, occupied: 0 });
        setRoomOptions({
          booking_allowed: false,
          booking_message: '',
          room_create_allowed: false,
          room_create_message: '',
          default_duration_minutes: 30,
          purposes: [],
          participants: [],
        });
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить бронирования.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canUseRooms) setActiveTab('desks');
  }, [canUseRooms]);

  useEffect(() => {
    setSelectedDeskId(null);
    setSelectedRoomId(null);
    setSuccess('');
    load();
  }, [selectedDate, canUseRooms]);

  const leftDesks = useMemo(
    () => buildDeskSlots(
      desks.filter((item) => item.side === 'left').sort((a, b) => a.row - b.row).slice(0, MAX_DESKS_PER_SIDE),
      'left',
    ),
    [desks],
  );
  const rightDesks = useMemo(
    () => buildDeskSlots(
      desks.filter((item) => item.side === 'right').sort((a, b) => a.row - b.row).slice(0, MAX_DESKS_PER_SIDE),
      'right',
    ),
    [desks],
  );
  const selectedDesk = useMemo(() => desks.find((item) => item.id === selectedDeskId) || null, [desks, selectedDeskId]);
  const selectedRoom = useMemo(() => rooms.find((item) => item.id === selectedRoomId) || null, [rooms, selectedRoomId]);

  const bookDesk = async () => {
    if (!selectedDesk) return;
    if (!isDeskBookingAllowed) return setError(deskBookingMessage || 'Бронирование на этот день недоступно.');
    if (myDeskBooking) return setError('У вас уже есть бронь рабочего места на эту дату. Сначала отмените её.');
    if (!selectedDesk.is_available) return setError('На время вашей смены это место уже занято.');
    setBusyDeskId(selectedDesk.id);
    setError('');
    try {
      const response = await desksAPI.book({ desk_id: selectedDesk.id, date: selectedDate });
      const payload = response?.data || {};
      setSuccess(`Место ${selectedDesk.code} забронировано на ${formatTimeRange(payload.start_time, payload.end_time)}.`);
      setSelectedDeskId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось забронировать место.');
    } finally {
      setBusyDeskId(null);
    }
  };

  const cancelDesk = async () => {
    if (!myDeskBooking?.id) return;
    setBusyDeskId(myDeskBooking.desk?.id || -1);
    setError('');
    try {
      await desksAPI.cancel(myDeskBooking.id);
      setSuccess(`Бронь ${myDeskBooking.desk?.code || ''} отменена.`);
      setSelectedDeskId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отменить бронь.');
    } finally {
      setBusyDeskId(null);
    }
  };

  const bookRoom = async (payload) => {
    setBusyRoomId(payload.room_id);
    setError('');
    try {
      const response = await desksAPI.roomBook(payload);
      const booking = response?.data || {};
      setSuccess(`Переговорная "${selectedRoom?.name || ''}" забронирована на ${formatTimeRange(booking.start_time, booking.end_time)}.`);
      setSelectedRoomId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось забронировать переговорную.');
    } finally {
      setBusyRoomId(null);
    }
  };

  const cancelRoom = async (bookingId) => {
    setBusyRoomId(selectedRoom?.id || -1);
    setError('');
    try {
      await desksAPI.roomCancel(bookingId);
      setSuccess('Бронь переговорной отменена.');
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отменить бронь переговорной.');
    } finally {
      setBusyRoomId(null);
    }
  };

  const deleteRoom = async (roomId) => {
    setBusyRoomId(roomId);
    setError('');
    try {
      await desksAPI.roomDelete(roomId);
      setSuccess('Переговорная удалена.');
      setSelectedRoomId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить переговорную.');
    } finally {
      setBusyRoomId(null);
    }
  };

  const createRoom = async (payload) => {
    if (!roomOptions.room_create_allowed) {
      setError(roomOptions.room_create_message || 'Добавление переговорных недоступно.');
      return;
    }
    setCreatingRoom(true);
    setError('');
    try {
      const response = await desksAPI.roomCreate(payload);
      const room = response?.data || {};
      setSuccess(`Переговорная "${room.name || ''}" добавлена.`);
      setIsCreateRoomOpen(false);
      await load();
      if (room.id) setSelectedRoomId(room.id);
    } catch (e) {
      const detail = e.response?.data?.name?.[0] || e.response?.data?.detail || 'Не удалось добавить переговорную.';
      setError(detail);
    } finally {
      setCreatingRoom(false);
    }
  };

  const renderDeskCard = (desk) => {
    const isPlaceholder = !!desk.is_placeholder;
    const isMine = !!desk.booked_by_me;
    const isAvailable = !!desk.is_available;
    const hasBookings = Array.isArray(desk.bookings) && desk.bookings.length > 0;
    const isSelected = !isPlaceholder && selectedDeskId === desk.id;
    const borderColor = isPlaceholder ? '#cbd5e1' : isMine ? '#2563eb' : isAvailable ? '#93c5fd' : '#1f2937';
    const bgColor = isPlaceholder
      ? 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
      : isMine
        ? 'linear-gradient(180deg, #eff6ff 0%, #bfdbfe 100%)'
        : isAvailable
          ? 'linear-gradient(180deg, #ffffff 0%, #dbeafe 100%)'
          : 'linear-gradient(180deg, #334155 0%, #0f172a 100%)';
    const labelColor = isPlaceholder ? '#94a3b8' : !isAvailable && !isMine ? '#e2e8f0' : '#334155';
    const noteColor = isPlaceholder ? '#94a3b8' : !isAvailable && !isMine ? '#cbd5e1' : '#64748b';
    const noteText = isPlaceholder
      ? 'Нет места'
      : isMine
        ? formatTimeRange(myDeskBooking?.start_time, myDeskBooking?.end_time)
        : hasBookings
          ? `${desk.bookings.length} бронь`
          : 'Свободно';

    return (
      <button
        key={desk.id}
        type="button"
        onClick={() => !isPlaceholder && setSelectedDeskId(desk.id)}
        title={isPlaceholder ? 'Место не настроено' : buildBookingsTitle(desk.bookings)}
        disabled={isPlaceholder}
        style={{
          width: 112,
          minHeight: 88,
          borderRadius: 18,
          border: `2px solid ${borderColor}`,
          background: bgColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: isPlaceholder ? 'default' : 'pointer',
          boxShadow: isSelected ? '0 0 0 4px rgba(37,99,235,0.2)' : '0 12px 24px rgba(148,163,184,0.16)',
          padding: '12px 10px',
          opacity: isPlaceholder ? 0.75 : 1,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: isPlaceholder ? '#e2e8f0' : !isAvailable && !isMine ? 'rgba(255,255,255,0.14)' : '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isPlaceholder ? '#94a3b8' : !isAvailable && !isMine ? '#cbd5e1' : '#2563eb',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {isPlaceholder ? '·' : '•'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1, color: labelColor }}>{desk.code}</div>
        <div style={{ fontSize: 11, color: noteColor, textAlign: 'center', fontWeight: 600 }}>{noteText}</div>
      </button>
    );
  };

  return (
    <MainLayout title="Офис">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">Офис</div>
          <div className="page-subtitle">{canUseRooms ? 'Рабочие места по графику и переговорные по свободным окнам' : 'Рабочие места по вашему утвержденному графику'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>Дата</div>
          <input type="date" className="form-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 160 }} />
        </div>
      </div>

      {canUseRooms && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={activeTab === 'desks' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setActiveTab('desks')}>Рабочие места</button>
            <button type="button" className={activeTab === 'rooms' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setActiveTab('rooms')}>Переговорные</button>
          </div>
        </div>
      )}

      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {success && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#166534' }}>{success}</div></div>}

      {activeTab === 'desks' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}>Всего: <b>{deskStats.total}</b></div>
                <div style={{ fontSize: 13, color: '#16a34a' }}>Свободно: <b>{deskStats.available}</b></div>
                <div style={{ fontSize: 13, color: '#ef4444' }}>Занято: <b>{deskStats.occupied}</b></div>
                {userShift?.start_time && userShift?.end_time && <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>Ваш график: <b>{formatTimeRange(userShift.start_time, userShift.end_time)}</b></div>}
              </div>
              {myDeskBooking && <div style={{ fontSize: 13, color: '#2563eb' }}>Ваша бронь: <b>{myDeskBooking.desk?.code}</b> {formatTimeRange(myDeskBooking.start_time, myDeskBooking.end_time)}</div>}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ fontSize: 13, color: isDeskBookingAllowed ? 'var(--gray-600)' : '#b91c1c' }}>
              {isDeskBookingAllowed ? 'Бронь рабочего места ставится автоматически на время вашей офисной смены.' : deskBookingReason === 'online_day' ? 'У вас онлайн-день, поэтому офисное место забронировать нельзя.' : deskBookingReason === 'no_schedule' ? 'На эту дату нет утвержденного офисного графика.' : deskBookingMessage || 'Рабочие места недоступны'}
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ padding: 18, overflowX: 'auto' }}>
              {loading ? (
                <div style={{ color: 'var(--gray-500)' }}>Загрузка схемы мест...</div>
              ) : (
                <div
                  style={{
                    maxWidth: 920,
                    margin: '0 auto',
                    padding: 18,
                    borderRadius: 28,
                    background: 'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
                    border: '1px solid #dbe7f5',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 24px 48px rgba(148,163,184,0.14)',
                  }}
                >
                  <div style={{ height: 28, borderRadius: 18, background: 'linear-gradient(180deg, #dbe7f5 0%, #c7d5e7 100%)', border: '1px solid #b6c6db', marginBottom: 22, display: 'grid', gridTemplateColumns: '1.1fr 2.2fr 1.1fr', gap: 10, padding: 6 }}>
                    <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.4)' }} />
                    <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.32)' }} />
                    <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(260px, 340px) 132px', gap: 18, justifyContent: 'center', alignItems: 'start' }}>
                    <div style={{ display: 'grid', gridTemplateRows: `repeat(${MAX_DESKS_PER_SIDE}, minmax(88px, auto))`, gap: 14 }}>
                      {leftDesks.map(renderDeskCard)}
                    </div>
                    <div style={{ minHeight: 820, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          maxWidth: 340,
                          minHeight: 700,
                          borderRadius: 34,
                          background: 'linear-gradient(180deg, #d3deea 0%, #bccad9 100%)',
                          border: '2px solid #aab8c7',
                          boxShadow: '0 16px 36px rgba(148,163,184,0.24)',
                          display: 'grid',
                          gridTemplateRows: 'repeat(7, 1fr)',
                          gap: 12,
                          padding: '22px 38px',
                        }}
                      >
                        {Array.from({ length: 7 }, (_, index) => (
                          <div key={`desk-segment-${index}`} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.24)', border: '1px solid rgba(148,163,184,0.24)' }} />
                        ))}
                        {Array.from({ length: 5 }, (_, index) => (
                          <div key={`chair-left-${index}`} style={{ position: 'absolute', left: -26, top: 78 + index * 124, width: 22, height: 48, borderRadius: 12, background: 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)', boxShadow: '0 8px 18px rgba(100,116,139,0.18)' }} />
                        ))}
                        {Array.from({ length: 5 }, (_, index) => (
                          <div key={`chair-right-${index}`} style={{ position: 'absolute', right: -26, top: 78 + index * 124, width: 22, height: 48, borderRadius: 12, background: 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)', boxShadow: '0 8px 18px rgba(100,116,139,0.18)' }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateRows: `repeat(${MAX_DESKS_PER_SIDE}, minmax(88px, auto))`, gap: 14 }}>
                      {rightDesks.map(renderDeskCard)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {canUseRooms && activeTab === 'rooms' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}>Комнат: <b>{roomStats.total}</b></div>
                <div style={{ fontSize: 13, color: '#16a34a' }}>Есть окна: <b>{roomStats.available}</b></div>
                <div style={{ fontSize: 13, color: '#ef4444' }}>Без окон: <b>{roomStats.occupied}</b></div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 13, color: roomOptions.booking_allowed ? 'var(--gray-600)' : '#b91c1c' }}>
                  {roomOptions.booking_allowed ? 'По умолчанию встреча ставится на 30 минут, но время внутри свободного окна можно поменять.' : roomOptions.booking_message || 'Переговорные недоступны'}
                </div>
                {roomOptions.room_create_allowed && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsCreateRoomOpen(true)}>
                    Добавить переговорную
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {loading ? (
                <div style={{ color: 'var(--gray-500)' }}>Загрузка переговорных...</div>
              ) : !rooms.length ? (
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 18, background: 'var(--gray-50)', color: 'var(--gray-600)' }}>
                  Переговорные пока не добавлены.
                </div>
              ) : (
                rooms.map((room) => {
                  const nextFree = Array.isArray(room.free_slots) && room.free_slots.length ? room.free_slots[0] : null;
                  const hasFree = !!nextFree;
                  const bookingsCount = Array.isArray(room.bookings) ? room.bookings.length : 0;
                  return (
                    <button key={room.id} type="button" onClick={() => setSelectedRoomId(room.id)} style={{ borderRadius: 16, border: `2px solid ${hasFree ? '#16a34a' : '#ef4444'}`, background: hasFree ? '#f0fdf4' : '#fef2f2', padding: 18, minHeight: 132, textAlign: 'left', boxShadow: selectedRoomId === room.id ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{room.name}</div>
                      <div style={{ fontSize: 13, color: hasFree ? '#166534' : '#b91c1c', fontWeight: 600 }}>{hasFree ? 'Есть свободные окна' : 'Свободных окон нет'}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{nextFree ? `Ближайшее окно: ${nextFree.start_time} - ${nextFree.end_time}` : 'Вся дата уже занята'}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{bookingsCount ? `Броней на дату: ${bookingsCount}` : 'На эту дату броней нет'}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      <DeskModal desk={selectedDesk} onClose={() => setSelectedDeskId(null)} onBook={bookDesk} onCancel={cancelDesk} canBook={!!selectedDesk && !selectedDesk.booked_by_me && selectedDesk.is_available && !myDeskBooking && isDeskBookingAllowed} isBusy={busyDeskId === selectedDesk?.id} />
      <RoomModal room={selectedRoom} options={roomOptions} selectedDate={selectedDate} onClose={() => setSelectedRoomId(null)} onBook={bookRoom} onCancel={cancelRoom} onDeleteRoom={deleteRoom} isBusy={busyRoomId === selectedRoom?.id} bookingMessage={roomOptions.booking_message} canManageRooms={roomOptions.room_create_allowed} />
      <CreateRoomModal open={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} onCreate={createRoom} isBusy={creatingRoom} createMessage={roomOptions.room_create_allowed ? '' : roomOptions.room_create_message} />
    </MainLayout>
  );
}
