# Deployment Guide

All deployment assets and configurations are housed in `deployment/`. Root compatibility files are maintained to support automated CI/CD and hosting webhooks.

## 1. Railway Cloud Deployment

Railway automatically detects the root `Dockerfile` and `railway.json`.

```bash
# Deploy via Railway CLI
railway up
```

Configured environment variables:
- `PORT`: defaults to `8080`
- `DATABASE_PATH`: optional path override for SQLite database file

Healthcheck URL: `/health`

## 2. Docker Container Deployment

To build and run the Docker container locally or in production:

```bash
# Build the container image
docker build -t fintask-backend .

# Run container on port 8080
docker run -d -p 8080:8080 --name fintask-backend fintask-backend
```

## 3. Firebase Hosting (Web Client)

To deploy the static web frontend:

```bash
# Using firebase-tools CLI
npx firebase-tools deploy --only hosting
```

Target directory is configured in `firebase.json` under `backend/static`.

