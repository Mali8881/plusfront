# Frontend -> Backend Integration Matrix

Base URL: `VITE_API_URL` (default `http://127.0.0.1:8000/api`)
Namespace: `/api/v1`

## Auth and Session

| Area | Method | Endpoint | Request | Response (used fields) | Notes |
|---|---|---|---|---|---|
| Login | POST | `/v1/accounts/login/` | `{ username, password }` | `access/access_token`, `refresh/refresh_token` | Single contract, no fallback prefix |
| Restore session | GET | `/v1/accounts/me/profile/` | Bearer access token | `id, role, email, full_name, ...` | Called on bootstrap and after login |
| Update profile | PATCH | `/v1/accounts/me/profile/` | profile patch fields | updated profile object | Used in `/profile` |
| Refresh token | POST | `/v1/auth/refresh/` | `{ refresh }` | `access/access_token` | Interceptor retries failed 401 requests |

## Admin/Org APIs

| Area | Method | Endpoint | Request | Response | Routes |
|---|---|---|---|---|---|
| Users list | GET | `/v1/accounts/org/users/` | query params optional | list or paginated list | `/admin/users` |
| Create user | POST | `/v1/accounts/org/users/` | user payload | created user | `/admin/users` |
| Update user | PATCH | `/v1/accounts/org/users/{id}/` | user payload | updated user | `/admin/users` |
| Delete user | DELETE | `/v1/accounts/org/users/{id}/` | - | 204/200 | API layer ready |
| Toggle status | POST | `/v1/accounts/org/users/{id}/toggle-status/` | - | status changed | `/admin/users` |
| Set role | POST | `/v1/accounts/org/users/{id}/set-role/` | `{ role }` | updated role | `/admin/users` (superadmin role change) |
| Departments | GET | `/v1/accounts/org/departments/` | - | list | `/admin/users`, `/profile` |
| Positions | GET | `/v1/accounts/org/positions/` | - | list | `/admin/users`, `/profile` |
| Promotion requests | GET/POST | `/v1/accounts/promotion-requests/` | params/body | list/create | API layer standardized |
| Promotion approve | POST | `/v1/accounts/promotion-requests/{id}/approve/` | body optional | updated request | API layer standardized |
| Promotion reject | POST | `/v1/accounts/promotion-requests/{id}/reject/` | body optional | updated request | API layer standardized |

## Content/Other APIs (client unified to `/v1`)

| Area | Endpoint prefix |
|---|---|
| News | `/v1/core/news/` |
| Regulations | `/v1/content/regulations/` |
| Instructions | `/v1/content/instructions/` |
| Onboarding | `/v1/onboarding/...` |
| Schedules | `/v1/schedules/...` |
| Feedback | `/v1/feedback/tickets/...` |
| Audit | `/v1/core/audit/` |

## Route Guards and Role Rules

| Route group | Guard | Allowed roles |
|---|---|---|
| `/dashboard`, `/profile`, `/tasks`, `/schedule`, `/regulations`, `/instructions` | `PrivateRoute` | any authenticated |
| `/admin/*` (except system/interface) | `AdminRoute` | `superadmin`, `admin`, `systemadmin` (admin-like via `isAdminRole`) |
| `/admin/system`, `/admin/interface` | `SuperAdminRoute` | `superadmin` |
| `/onboarding` | `PrivateRoute` | all auth users (business behavior page-specific) |
| `/admin/onboarding` | `OnboardingManageRoute` | `projectmanager` |

## Known Remaining Backend-Contract Dependencies

Some pages still use mock/local data by design and need explicit backend contract to fully migrate CRUD behavior:
- `/admin/content`
- `/admin/roles`
- `/admin/overview`
- `/admin/interface`
- `/admin/system`
- `/admin/schedules` (partially local)
- `/admin/feedback` (data flow may require final contract confirmation)

These pages are now API-prefix consistent in client layer, but exact payload schemas must match backend serializers to complete 100% CRUD wiring.
