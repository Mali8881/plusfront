import api from './axios';

function toIso(date, time) {
  if (!date || !time) return '';
  return `${date}T${time}:00`;
}

function normalizeDeskResource(item = {}) {
  const row = Number(item.row || 0);
  const side = String(item.side || 'left').toLowerCase();
  const longitude = side === 'left' ? '74.569200' : '74.570400';
  const latitude = String(42.8746 + row * 0.00035);
  return {
    id: `desk-${item.id}`,
    raw_id: item.id,
    name: item.code || `Desk ${item.id}`,
    resource_type: 'desk',
    latitude,
    longitude,
    status: 'active',
  };
}

function normalizeRoomResource(item = {}) {
  const numericId = Number(item.id || 0);
  return {
    id: `room-${item.id}`,
    raw_id: item.id,
    name: item.name || `Room ${item.id}`,
    resource_type: 'meeting_room',
    latitude: String(42.876 + numericId * 0.00025),
    longitude: String(74.571 + numericId * 0.00025),
    status: 'active',
  };
}

function parseResourceId(resourceId) {
  const value = String(resourceId || '');
  if (value.startsWith('desk-')) return { kind: 'desk', id: Number(value.slice(5)) };
  if (value.startsWith('room-')) return { kind: 'meeting_room', id: Number(value.slice(5)) };
  return { kind: '', id: Number(value) || 0 };
}

function normalizeDeskBooking(item = {}) {
  return {
    id: item.id,
    starts_at: toIso(item.date, item.start_time),
    ends_at: toIso(item.date, item.end_time),
  };
}

function normalizeRoomBooking(item = {}) {
  return {
    id: item.id,
    starts_at: toIso(item.date, item.start_time),
    ends_at: toIso(item.date, item.end_time),
  };
}

function normalizeDeskSlots(payload = {}) {
  const bookings = Array.isArray(payload.my_booking) ? payload.my_booking : [];
  return Array.isArray(payload.desks)
    ? payload.desks
        .filter((desk) => desk.is_available)
        .map(() => ({
          starts_at: toIso(payload.date, payload.user_shift?.start_time || '09:00'),
          ends_at: toIso(payload.date, payload.user_shift?.end_time || '18:00'),
        }))
    : bookings;
}

function normalizeRoomSlots(payload = {}) {
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  const room = rooms[0] || {};
  const freeSlots = Array.isArray(room.free_slots) ? room.free_slots : [];
  return freeSlots.map((slot) => ({
    starts_at: toIso(payload.date, slot.start_time),
    ends_at: toIso(payload.date, slot.end_time),
  }));
}

export const resourcesAPI = {
  list: async () => {
    const [desksRes, roomsRes] = await Promise.all([
      api.get('/v1/desks/'),
      api.get('/v1/desks/rooms/'),
    ]);
    const desks = Array.isArray(desksRes?.data) ? desksRes.data.map(normalizeDeskResource) : [];
    const rooms = Array.isArray(roomsRes?.data) ? roomsRes.data.map(normalizeRoomResource) : [];
    return { data: [...desks, ...rooms] };
  },

  roomOptions: () => api.get('/v1/desks/rooms/options/'),
  roomAvailability: (params = {}) => api.get('/v1/desks/rooms/availability/', { params }),
  createRoom: (name) => api.post('/v1/desks/rooms/', { name }),
  deleteRoom: (id) => api.delete(`/v1/desks/rooms/${id}/`),

  freeSlots: async (resourceId, params = {}) => {
    const target = parseResourceId(resourceId);
    if (target.kind === 'desk') {
      const response = await api.get('/v1/desks/availability/', {
        params: {
          date: params.date,
          start_time: params.work_start || '09:00',
          end_time: params.work_end || '18:00',
        },
      });
      const desks = Array.isArray(response?.data?.desks) ? response.data.desks : [];
      const desk = desks.find((item) => Number(item.id) === target.id);
      const slots = desk && desk.is_available
        ? [{
            starts_at: toIso(response.data.date, response.data.requested_interval?.start_time || params.work_start || '09:00'),
            ends_at: toIso(response.data.date, response.data.requested_interval?.end_time || params.work_end || '18:00'),
          }]
        : [];
      return { data: { slots } };
    }

    const response = await api.get('/v1/desks/rooms/availability/', {
      params: { date: params.date },
    });
    const rooms = Array.isArray(response?.data?.rooms) ? response.data.rooms : [];
    const room = rooms.find((item) => Number(item.id) === target.id);
    const slots = Array.isArray(room?.free_slots)
      ? room.free_slots.map((slot) => ({
          starts_at: toIso(response.data.date, slot.start_time),
          ends_at: toIso(response.data.date, slot.end_time),
        }))
      : [];
    return { data: { slots } };
  },

  bookings: async (resourceId, params = {}) => {
    const target = parseResourceId(resourceId);
    if (target.kind === 'desk') {
      const response = await api.get('/v1/desks/availability/', {
        params: { date: params.date },
      });
      const bookings = response?.data?.my_booking ? [normalizeDeskBooking(response.data.my_booking)] : [];
      return { data: bookings };
    }

    const response = await api.get('/v1/desks/rooms/availability/', {
      params: { date: params.date },
    });
    const rooms = Array.isArray(response?.data?.rooms) ? response.data.rooms : [];
    const room = rooms.find((item) => Number(item.id) === target.id);
    const bookings = Array.isArray(room?.bookings) ? room.bookings : [];
    return { data: bookings, date: response?.data?.date };
  },

  createBooking: async (resourceId, data = {}) => {
    const target = parseResourceId(resourceId);
    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(data.ends_at);
    const date = data.starts_at ? data.starts_at.slice(0, 10) : '';
    const start_time = startsAt.toTimeString().slice(0, 5);
    const end_time = endsAt.toTimeString().slice(0, 5);

    if (target.kind === 'desk') {
      return api.post('/v1/desks/bookings/', {
        desk_id: target.id,
        date,
        start_time,
        end_time,
      });
    }

    return api.post('/v1/desks/rooms/bookings/', {
      room_id: target.id,
      date,
      start_time,
      end_time,
      purpose: data.purpose || 'discussion',
      participant_ids: data.participant_ids || [],
    });
  },

  deleteBooking: async (bookingId, resourceId) => {
    const target = parseResourceId(resourceId);
    if (target.kind === 'desk') {
      return api.delete(`/v1/desks/bookings/${bookingId}/`);
    }
    return api.delete(`/v1/desks/rooms/bookings/${bookingId}/`);
  },
};
