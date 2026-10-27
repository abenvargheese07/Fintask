# 🎯 Fintask — Smart Multi-Device Deadline & Task Engine

Fintask is an intelligent task management and escalating deadline urgency system built with a spatial glassmorphism visionOS design. It synchronizes tasks seamlessly across web and mobile platforms with real-time alerts.

---

## 🏗️ Repository Architecture & Directory Structure

```text
fintask/
├── app/                  # 💙 Multiplatform Flutter Client Application (Android, iOS, Web, macOS)
│   ├── android/          # Native Android configuration & build scripts
│   ├── ios/              # Native iOS project & Runner configuration
│   ├── macos/            # Native macOS desktop bundle
│   ├── web/              # Web application entry & manifests
│   ├── lib/              # Flutter / Dart application source code
│   │   ├── models/       # Task & Stats data models
│   │   ├── screens/      # Responsive VisionOS spatial views
│   │   ├── services/     # REST API, audio, & notification engines
│   │   ├── theme/        # Glassmorphic dark styling & typography
│   │   ├── utils/        # NLP natural language deadline & priority parser
│   │   └── widgets/      # Modular UI components & bottom sheets
│   └── test/             # Flutter widget and unit tests
│
├── backend/              # ⚡ High-Performance FastAPI Python Backend Service
│   ├── scripts/          # Workspace calculation & data transformation jobs
│   ├── static/           # Compiled web assets and landing bundle
│   ├── downloads/        # Direct-distribution build binaries (APK)
│   ├── db.py             # SQLite WAL storage & task lifecycle models
│   ├── main.py           # REST endpoints, CORS, background lifecycles
│   ├── reminders.py      # Background APScheduler & ntfy.sh push dispatcher
│   └── requirements.txt  # Python package dependencies
│
├── test/                 # 🧪 Backend & Integration Test Suites
│   └── test_db.py        # Database CRUD, lifecycles, and API unit tests
│
├── documentation/        # 📚 Architectural, API, and Deployment Guides
│   ├── ARCHITECTURE.md   # System layout & component relationships
│   ├── API.md            # REST API specifications and contracts
│   ├── DEPLOYMENT.md     # Railway, Docker, & Firebase deployment procedures
│   └── MOBILE.md         # Mobile build and notification setup
│
├── artifacts/            # 📦 Output Binaries & Distribution Assets
│   └── fintask.apk       # Compiled Android release APK package
│
├── deployment/           # 🚀 Container & Cloud Deployment Configurations
│   ├── Dockerfile        # Production container image definition
│   └── Procfile          # Process declaration for cloud platforms
│
├── scripts/              # 🛠️ Automation & Build Tooling
│   └── build_apk.sh      # Automated Flutter APK compilation & artifact syncer
│
├── run.py                # Server entrypoint and runner
├── railway.json          # Railway cloud build & deployment manifest
├── firebase.json         # Firebase Hosting configuration for static web app
└── .firebaserc           # Firebase active project specification
```

---

## 🌐 Live Deployments & Endpoints

| Resource | URL | Role |
| :--- | :--- | :--- |
| **Published Web App** | [https://fintask-aben-8a3f.web.app](https://fintask-aben-8a3f.web.app) | Firebase Hosting (Global CDN) |
| **Cloud Backend API** | [https://web-production-975c4.up.railway.app](https://web-production-975c4.up.railway.app) | Railway Cloud Container |
| **Direct APK Download** | [https://web-production-975c4.up.railway.app/download-apk](https://web-production-975c4.up.railway.app/download-apk) | 1-Click Android App Installer |

---

## 🚀 Quick Start

### 1. Run Backend Server
```bash
# Using Python virtual environment:
./.venv/bin/python run.py
# Or using the root runner:
python run.py
```
Backend will start on `http://0.0.0.0:8080`.

### 2. Run Flutter Client Application
```bash
cd app
flutter pub get
flutter run
```

### 3. Run Automated Tests
```bash
# Backend unit tests:
./.venv/bin/python -m unittest discover test

# Flutter widget tests:
cd app && flutter test
```

### 4. Build Android Release APK
```bash
./scripts/build_apk.sh
# Outputs:
#   -> artifacts/fintask.apk
#   -> backend/downloads/fintask.apk
```

---

## 📚 Documentation
For in-depth guides, see the [`documentation/`](documentation/) directory:
- [System Architecture](documentation/ARCHITECTURE.md)
- [REST API Specifications](documentation/API.md)
- [Cloud & Container Deployment](documentation/DEPLOYMENT.md)
- [Mobile & Push Notifications Setup](documentation/MOBILE.md)
