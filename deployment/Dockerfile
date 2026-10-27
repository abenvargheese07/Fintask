FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source, runner, and release artifacts
COPY run.py .
COPY backend/ ./backend/
COPY artifacts/ ./artifacts/
RUN ln -s backend app

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH="/app/backend:/app"
ENV PORT=8080
EXPOSE 8080

CMD ["python", "run.py"]
