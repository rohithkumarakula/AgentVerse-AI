# AgentVerse AI

One Platform. Infinite AI Agents.

AgentVerse AI is a multi-agent AI platform that provides specialized AI assistants for different areas through a single unified interface.

## Live Demo

https://agent-verse-ai-teal.vercel.app

## AI Agents

| Agent | Purpose |
|---|---|
| TailorAI | Career and placement assistance |
| StudyAI | Education and learning assistance |
| LifeAI | Productivity and everyday assistance |
| CodeAI | Programming and coding assistance |
| FinanceAI | Personal finance analysis |
| HealthAI | Health and fitness assistance |

## Key Features

- Six specialized AI agents
- Text-based AI conversations
- Image analysis for supported agents
- Chat history
- New chat functionality
- Copy, edit and share message actions
- Responsive desktop and mobile interface
- Centralized API client
- FastAPI backend
- React frontend
- Production deployment

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- CSS

### Backend
- Python
- FastAPI
- Groq API

### Deployment
- Vercel — Frontend
- Render — Backend

## Architecture

Frontend
    ↓
Vercel
    ↓
FastAPI Backend
    ↓
Groq AI
    ↓
Specialized Agent

## Project Structure

AgentVerse-AI/
├── frontend/
├── backend/
├── README.md
├── BUILD_LOG.md
├── CHANGELOG.md
├── ROADMAP.md
└── LICENSE

## Running Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at:

http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

http://localhost:5173

## Environment Variables

### Frontend

Create a `.env` file inside the `frontend` folder:

```env
VITE_API_URL=http://localhost:8000
```

For production, the frontend uses the deployed backend URL.

### Backend

Keep API keys and other sensitive credentials in environment variables. Do not commit `.env` files or API keys to GitHub.

## API Endpoints

The backend currently provides endpoints for:

- `/career-profile`
- `/career-ai`
- `/tailor-ai`
- `/study-ai`
- `/life-ai`
- `/code-ai`
- `/finance-ai`

## Testing

AgentVerse AI has been tested for:

- AI agent responses
- Image analysis
- Chat functionality
- Chat history
- New chat functionality
- Message actions
- Desktop responsive UI
- Mobile responsive UI
- Frontend-to-backend communication
- Production deployment

## Documentation

Additional project documentation:

- `BUILD_LOG.md` — development progress
- `CHANGELOG.md` — project changes
- `ROADMAP.md` — future plans and development direction

## Deployment

The production application is deployed using:

- **Frontend:** Vercel
- **Backend:** Render

Live application:

https://agent-verse-ai-teal.vercel.app

## Future Improvements

- Additional specialized AI agents
- Improved agent orchestration
- More advanced memory capabilities
- Voice interaction
- Additional image-based capabilities
- Enhanced personalization

## License

This project is licensed under the MIT License.

## Author

**Rohith Akula**

GitHub: https://github.com/rohithkumarakula

---

Built as part of the `#60DaysOfAgentVerseAI` journey.
