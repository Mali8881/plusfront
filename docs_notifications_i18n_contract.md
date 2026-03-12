# Notifications i18n Contract (Frontend <-> Backend)

## Request
- Header: `Accept-Language: ru | en | kg`
- Optional query param fallback: `?lang=ru|en|kg`
- If no language is provided, backend defaults to `ru`.

## Notification response shape
- Use stable machine codes in payload:
  - `code` (example: `promotion_request`, `schedule_request`, `feedback_ticket`)
  - `status` (example: `pending`, `approved`, `rejected`)
- Human text fields are optional and may already be localized:
  - `title`
  - `message`

Example:

```json
{
  "items": [
    {
      "id": 123,
      "code": "promotion_request",
      "status": "pending",
      "title": "Заявка на перевод",
      "message": "Сотрудник отправил заявку на перевод",
      "created_at": "2026-03-04T10:15:00Z",
      "payload": {
        "user_id": 17
      }
    }
  ],
  "unread_count": 2
}
```

## Error shape

```json
{
  "code": "validation_error",
  "detail": "Некорректный запрос"
}
```

- `code` is stable for frontend logic.
- `detail` is localized for direct UI output.

## Frontend behavior
- UI text is translated via `t(key, fallback)`.
- API codes are mapped to i18n keys:
  - `notifications.code.<code>.title`
  - `notifications.code.<code>.message`
  - `status.<status>`
- Fallback chain:
  1. selected locale
  2. `ru`
  3. provided fallback text

## Minimal frontend-backend agreement
- Language: `Accept-Language: ru|en|kg`
- Roles/statuses: machine codes only
- Errors: `{ code, detail }`
- Content: multilingual fields or localized response by lang
