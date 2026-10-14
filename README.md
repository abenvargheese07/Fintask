# 🎯 Fintask — Smart Multi-Device Deadline & Task Engine

Fintask is an intelligent task management and escalating deadline urgency system built with a spatial glassmorphism visionOS design. It synchronizes tasks seamlessly across web and mobile platforms with real-time alerts.

---

## 🏗️ Repository Architecture & Directory Structure

```text
fintask/
├── app/                          # 🐍 Python FastAPI Backend Service
│   ├── __init__.py
│   ├── db.py                     # SQLite schema, queries, migrations & persistent storage
│   ├── main.py                   # FastAPI REST API endpoints, CORS & APK streamer
│   ├── reminders.py              # APScheduler escalating reminder engine & push alerts
│   ├── downloads/                # 📦 Packaged distribution binaries
│   │   └── fintask.apk           # Production Android APK build
│   └── static/                   # 🌐 Compiled production React web assets (SPA)
│       ├── assets/
│       ├── index.html
│       └── bg.jpg
├── frontend/                     # ⚛️ React 18 + Vite Frontend Application
│   ├── android/                  # 🤖 Native Android Studio project (Capacitor)
│   │   ├── app/
│   │   │   └── build/outputs/apk/debug/app-debug.apk
│   │   ├── build.gradle
│   │   └── gradlew
│   ├── ios/                      # 🍎 Native iOS Xcode project (Capacitor)
│   ├── public/                   # Static assets (favicons, background wallpapers)
│   ├── src/
│   │   ├── assets/               # SVGs and UI visual tokens
│   │   ├── mobile/               # 📱 Dedicated touch-first mobile view components
│   │   │   ├── MobileView.jsx    # Touch navigation, bottom sheet, donut gauge
│   │   │   ├── mobile.css        # Mobile safe area and gesture styling
│   │   │   └── notifications.js  # Capacitor native notification channels & scheduler
│   │   ├── App.jsx               # Main spatial visionOS desktop workspace & two-way sync
│   │   ├── App.css
│   │   ├── index.css             # Glassmorphism design system & typography tokens
│   │   └── main.jsx
│   ├── capacitor.config.json     # Capacitor native runtime configuration
│   ├── package.json
│   └── vite.config.js
├── tests/                        # 🧪 Integration & Unit Test Suite
│   ├── __init__.py
│   └── test_db.py                # Database CRUD and schema migration tests
├── Dockerfile                    # Container configuration for Railway deployment
├── Procfile                      # Process declaration for cloud platforms
├── railway.json                  # Railway cloud deployment manifest
├── firebase.json                 # Firebase Hosting configuration for static web app
├── run.py                        # Python production runner that safely parses $PORT
├── requirements.txt              # Backend Python dependencies
└── fintask.db                    # Local SQLite development database
```

---

## 🌐 Live Deployments & Endpoints

| Resource | URL | Role |
| :--- | :--- | :--- |
| **Published Web App** | [https://fintask-aben-8a3f.web.app](https://fintask-aben-8a3f.web.app) | Firebase Hosting (Global CDN) |
| **Cloud Backend API** | [https://web-production-975c4.up.railway.app](https://web-production-975c4.up.railway.app) | Railway Cloud Container |
| **Direct APK Download** | [https://web-production-975c4.up.railway.app/download-apk](https://web-production-975c4.up.railway.app/download-apk) | 1-Click Android App Installer |

---

## 🚀 Key Features

1. **Spatial Glassmorphism UI**: Inspired by visionOS and modern spatial interfaces with subtle blurs, glowing priority indicators, and responsive ambient depth.
2. **Dedicated Mobile Edition**: Adaptive touch-first UI with native safe-area insets, interactive donut task-completion gauge, and bottom sheets for task scheduling.
3. **Escalating Reminder Engine**: Multi-tiered deadline alerts where frequency and audio chimes accelerate as deadlines approach (24h → 2h → 30m → Due → Overdue).
4. **Instant Two-Way Sync**: Live bi-directional polling between the published Firebase web app and native Android devices via the Railway HTTPS backend.
5. **Native Notifications**: Android heads-up notifications with custom importance channels and vibration triggers via Capacitor.

---

## 💻 Local Development Workflow

### 1. Backend (FastAPI)
```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend with auto-reload
python run.py
# Or: uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install --registry https://registry.npmmirror.com

# Start Vite development server
npm run dev

# Build production bundle (outputs to app/static/)
npm run build
```

### 3. Mobile Build (Android)
```bash
cd frontend
# Sync React build into native Android
npx cap sync

# Build Android debug APK
cd android
JAVA_HOME=$HOME/.jdk/jdk-21.0.12.1+1/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleDebug
```

### 4. Running Tests
```bash
PYTHONPATH=. python tests/test_db.py
```
