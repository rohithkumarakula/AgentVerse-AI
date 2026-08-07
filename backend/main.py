from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AgentVerse AI",
    description="One Platform. Infinite AI Agents.",
    version="0.1.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "message": "🚀 Welcome to AgentVerse AI",
        "status": "Backend is running successfully!"
    }

@app.get("/health")
def health():
    return {
        "status": "Healthy",
        "service": "AgentVerse AI Backend"
    }