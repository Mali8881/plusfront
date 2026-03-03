import axios from 'axios';

const API_URL = process.env.SMOKE_API_URL || process.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const USERNAME = process.env.SMOKE_LOGIN;
const PASSWORD = process.env.SMOKE_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('SMOKE_LOGIN and SMOKE_PASSWORD are required');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

async function run() {
  console.log(`[smoke] API: ${API_URL}`);

  const loginRes = await client.post('/v1/accounts/login/', {
    username: USERNAME,
    password: PASSWORD,
  });

  const access = loginRes.data?.access || loginRes.data?.access_token;
  const refresh = loginRes.data?.refresh || loginRes.data?.refresh_token;

  if (!access || !refresh) {
    throw new Error('login response has no access/refresh token');
  }

  console.log('[smoke] login: OK');

  const authClient = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access}`,
    },
  });

  const profileRes = await authClient.get('/v1/accounts/me/profile/');
  if (!profileRes.data) throw new Error('profile response is empty');

  console.log(`[smoke] profile: OK (id=${profileRes.data.id ?? 'n/a'})`);

  const refreshRes = await client.post('/v1/auth/refresh/', { refresh });
  const refreshedAccess = refreshRes.data?.access || refreshRes.data?.access_token;
  if (!refreshedAccess) throw new Error('refresh response has no access token');

  console.log('[smoke] refresh: OK');

  const refreshedClient = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshedAccess}`,
    },
  });

  await refreshedClient.get('/v1/accounts/me/profile/');
  console.log('[smoke] profile after refresh: OK');

  console.log('[smoke] DONE');
}

run().catch((err) => {
  const status = err?.response?.status;
  const detail = err?.response?.data || err?.message;
  console.error('[smoke] FAILED', status ? `(status ${status})` : '', detail);
  process.exit(1);
});
