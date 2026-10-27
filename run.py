import os
import sys
from pathlib import Path
import uvicorn

# Forwarder to backend service
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / 'backend'
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

if __name__ == '__main__':
    port_str = os.environ.get('PORT', '8080')
    try:
        port = int(port_str)
    except ValueError:
        port = 8080
    print(f'Starting Fintask backend on 0.0.0.0:{port}...')
    try:
        from backend.main import app as application
    except ImportError:
        from main import app as application
    uvicorn.run(application, host='0.0.0.0', port=port)
