from fastapi import FastAPI

app = FastAPI(title="Fintask")


@app.get("/health")
def health():
    return {"status": "ok", "app": "fintask"}