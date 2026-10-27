# REST API Documentation

The Fintask backend exposes standard REST endpoints for managing financial tasks, server settings, and push notifications.

Base URL: `http://localhost:8080` (or Railway production URL)

## Endpoints

### 1. Health Check
- **`GET /health`**
  - Returns `{"status": "ok", "app": "fintask"}`.

### 2. Task Management
- **`GET /api/tasks`**
  - Query parameters:
    - `view`: `today` | `upcoming` | `overdue` | `done` | `all` (default: `today`)
    - `client_now`: ISO timestamp for client timezone resolution
    - `client_today`: Date string (`YYYY-MM-DD`)
  - Returns list of Task objects.

- **`POST /api/tasks`** (Status `201`)
  - Request body:
    ```json
    {
      "title": "Pay rent",
      "notes": "Bank transfer via UPI",
      "due_at": "2026-10-31T18:00",
      "priority": 1
    }
    ```

- **`PATCH /api/tasks/{task_id}`**
  - Update title, notes, due date, or priority.

- **`POST /api/tasks/{task_id}/complete`**
  - Marks task as done.

- **`POST /api/tasks/{task_id}/reopen`**
  - Reopens completed task.

- **`POST /api/tasks/{task_id}/snooze?minutes=15`**
  - Reschedules task deadline forward by specified minutes.

- **`DELETE /api/tasks/{task_id}`**
  - Permanently removes task.

### 3. Statistics
- **`GET /api/stats`**
  - Returns:
    ```json
    {
      "total": 12,
      "done": 5,
      "overdue": 1,
      "today": 4,
      "pending": 7
    }
    ```

### 4. Settings & Push Notifications
- **`GET /api/settings`**
  - Retrieves configured `ntfy_topic`, `timezone`, and `timezone_offset`.

- **`POST /api/settings`**
  - Updates notification topic and time preferences.

- **`POST /api/test-notification`**
  - Dispatches an immediate test push to desktop and mobile devices.

### 5. APK Distribution
- **`GET /download-apk`**
  - Downloads the compiled Android release APK package directly.

