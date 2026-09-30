# ToolSense Backend

A Node.js + Express backend for monitoring CNC tool wear in real-time.

## Features

- **Real-time Monitoring**: Track tool wear across multiple cutting edges (flutes)
- **ML-Powered Predictions**: Estimates remaining useful life (RUL) based on sensor readings
- **Smart Alerts**: Automatic status classification (NORMAL, WARNING, CRITICAL)
- **Historical Analysis**: Query historical readings with optional limit
- **PostgreSQL Backend**: Reliable data persistence with proper indexing

## Setup

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

### Installation

1. Clone and navigate to the backend:
```bash
cd backend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure `.env` with your PostgreSQL connection:
```
DATABASE_URL=postgresql://user:password@localhost:5432/toolsense
PORT=3000
```

4. Set up the database:
```bash
npm run db:setup
```

5. Start the server:
```bash
npm start
```

Or with auto-reload during development:
```bash
npm run dev
```

The server will listen on `http://localhost:3000`

## API Endpoints

### Health Check
```bash
GET /health
```

### Create Reading
```bash
POST /readings
Content-Type: application/json

{
  "tool_id": 1,
  "cut_number": 42,
  "force_x": 150.5,
  "force_y": 120.3,
  "force_z": 200.1,
  "vib_x": 0.5,
  "vib_y": 0.3,
  "vib_z": 0.4,
  "ae_rms": 0.8
}
```

**Response:**
```json
{
  "id": 1,
  "tool_id": 1,
  "cut_number": 42,
  "force_x": 150.5,
  "force_y": 120.3,
  "force_z": 200.1,
  "vib_x": 0.5,
  "vib_y": 0.3,
  "vib_z": 0.4,
  "ae_rms": 0.8,
  "wear_f1": 8.5,
  "wear_f2": 7.2,
  "wear_f3": 9.1,
  "rul": 287,
  "status": "NORMAL",
  "recommendation": "Tool is operating normally",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Get All Tools
```bash
GET /tools
```

### Get Specific Tool
```bash
GET /tools/:id
```

### Get Latest Reading for Tool
```bash
GET /tools/:id/latest
```

**Response:**
```json
{
  "id": 5,
  "tool_id": 1,
  "cut_number": 150,
  "wear_f1": 35.2,
  "wear_f2": 32.8,
  "wear_f3": 38.1,
  "rul": 185,
  "status": "NORMAL",
  "recommendation": "Tool is operating normally",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Reading History
```bash
GET /tools/:id/history?limit=50
```

Returns up to 50 readings ordered by cut number (ascending). Default limit is 100.

### Get All Alerts
```bash
GET /alerts
```

Returns all readings where `status != 'NORMAL'`, ordered by creation time (newest first).

**Response:**
```json
[
  {
    "id": 15,
    "tool_id": 1,
    "cut_number": 280,
    "wear_f1": 135.0,
    "wear_f2": 142.5,
    "wear_f3": 138.2,
    "rul": 12,
    "status": "CRITICAL",
    "recommendation": "Replace tool immediately to avoid tool breakage",
    "created_at": "2024-01-15T15:30:00.000Z"
  }
]
```

## Status Levels

- **NORMAL**: `maxWear < 0.8 × wearLimit` (80% threshold)
  - Recommendation: Tool is operating normally

- **WARNING**: `0.8 × wearLimit ≤ maxWear < wearLimit`
  - Recommendation: Consider reducing feed rate to extend tool life

- **CRITICAL**: `maxWear ≥ wearLimit`
  - Recommendation: Replace tool immediately to avoid tool breakage

## Database Schema

### tools
```sql
id (serial, pk)
name (text, unique)
wear_limit (float, default 170)
created_at (timestamptz)
```

### readings
```sql
id (serial, pk)
tool_id (int, fk → tools.id)
cut_number (int)
force_x, force_y, force_z (float)
vib_x, vib_y, vib_z (float)
ae_rms (float)
wear_f1, wear_f2, wear_f3 (float) - Predicted wear per flute
rul (float) - Remaining useful life in cuts
status (text) - NORMAL, WARNING, or CRITICAL
created_at (timestamptz)
```

## Example: Simulating Tool Wear Over Time

```bash
# Create 5 readings as the tool wears over 315 cuts
for cut in 50 100 150 250 315; do
  curl -X POST http://localhost:3000/readings \
    -H "Content-Type: application/json" \
    -d "{
      \"tool_id\": 1,
      \"cut_number\": $cut,
      \"force_x\": 150.5,
      \"force_y\": 120.3,
      \"force_z\": 200.1,
      \"vib_x\": 0.5,
      \"vib_y\": 0.3,
      \"vib_z\": 0.4,
      \"ae_rms\": 0.8
    }"
done

# Check the tool's status progression
curl http://localhost:3000/tools/1/history?limit=100

# Get alerts when tool reaches WARNING or CRITICAL
curl http://localhost:3000/alerts
```

## Architecture

### Services

- **mlClient.js**: Mock ML prediction service
  - Returns realistic wear progression based on cut number
  - Includes per-flute variation and noise for realism
  - Easy to replace with real HTTP call to ML service

- **decision.js**: Status decision engine
  - Maps wear values to status levels (NORMAL/WARNING/CRITICAL)
  - Provides actionable recommendations

### Controllers

- **readingsController.js**: Handles reading creation and querying
  - Input validation
  - ML prediction integration
  - Status determination and storage

- **toolsController.js**: Tool management

- **alertsController.js**: Alert retrieval

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3000 |
| `ML_SERVICE_URL` | ML service endpoint (future use) | http://localhost:8000/predict |

## Development

- **node --watch**: Automatic restart on file changes
- **Schema changes**: Edit `src/db/schema.sql` and re-run `npm run db:setup`
- **Mock ML to real service**: See comment in `src/services/mlClient.js`

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Resource created
- `400`: Bad request (validation error)
- `404`: Not found
- `500`: Server error

Error responses include a descriptive `error` field.

## Next Steps

1. **Frontend**: Build React/Vue dashboard for visualization
2. **Real ML Service**: Replace mock prediction with actual model API
3. **Authentication**: Add JWT for secure API access
4. **Notifications**: Integrate Slack/email for alerts
5. **Analytics**: Add aggregation endpoints for trend analysis

## License

MIT
