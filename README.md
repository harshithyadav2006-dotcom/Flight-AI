# SkyPilot AI

Full-stack aviation safety dashboard.

## Project Structure

```
y/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/    # Navbar, Hero, Features, Footer
│   │   ├── pages/         # DashboardPage
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/            # Static assets (hero-bg.png, icons)
│   ├── index.html
│   └── package.json
│
└── backend/           # Flask + Socket.IO server
    ├── app.py             # Entry point
    ├── .env               # Environment variables
    ├── requirements.txt
    ├── routes/
    │   ├── telemetry.py   # GET /api/telemetry
    │   ├── weather.py     # GET /api/weather
    │   └── condition.py   # GET|POST /api/condition
    ├── services/
    │   ├── simulator.py   # Background live-data emitter (Socket.IO)
    │   └── condition_engine.py
    └── models/
        └── flight_data.py # Data schemas
```

## Running

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

## Socket.IO Events (Backend → Frontend)

| Event              | Payload                          | Interval |
|--------------------|----------------------------------|----------|
| `telemetry_update` | Full telemetry + weather object  | 2s       |
| `condition_update` | `{ condition: "NORMAL" }`        | 4s       |

## REST API

| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| GET    | `/api/telemetry`      | Current flight telemetry  |
| GET    | `/api/weather`        | Current weather snapshot  |
| GET    | `/api/condition`      | Current flight condition  |
| POST   | `/api/condition/:id`  | Override condition state  |
