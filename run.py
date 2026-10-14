import os
import uvicorn

if __name__ == '__main__':
    port_str = os.environ.get('PORT', '8080')
    try:
        port = int(port_str)
    except ValueError:
        port = 8080
    print(f'Starting Fintask backend on 0.0.0.0:{port}...')
    uvicorn.run('app.main:app', host='0.0.0.0', port=port)
