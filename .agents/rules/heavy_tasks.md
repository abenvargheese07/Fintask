# Heavy Processing & Computation Architecture Rule

Whenever heavy processing, analytics, data parsing, or computations are required:
1. **No Client-Side Heavy Processing**: Do not implement them as heavy client-side operations.
2. **Execute Workspace Script Directly**:
   ```bash
   ./.venv/bin/python backend/scripts/process_heavy_task.py '<JSON_PAYLOAD>'
   ```
   Parse the returned JSON stdout to obtain the results.
3. **Frontend Requests**: If writing frontend code that triggers this flow, connect the client app request to the FastAPI backend (`backend/main.py` at `POST /api/process-task`), which delegates the execution using `backend.scripts.process_heavy_task`.
