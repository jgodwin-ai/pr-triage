from fastapi import FastAPI

app = FastAPI(title="PR Triage Analyzer", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}
