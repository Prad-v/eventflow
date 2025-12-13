# Internal Status Page

An internal status portal that aggregates health from multiple services, supports incidents/maintenance windows, and offers an API for integrations.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Development Setup

#### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker compose up -d

# API available at http://localhost:8000
# Frontend available at http://localhost:3000
```

#### Option 2: Manual Setup

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (or create .env file)
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/statuspage
export DEBUG=true

# Run the API
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Set API URL
export VITE_API_URL=http://localhost:8000

# Run development server
npm run dev
```

## Project Structure

```
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/            # API route handlers
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── hooks/         # TanStack Query hooks
│   │   └── pages/         # Page components
│   ├── Dockerfile
│   └── package.json
│
├── charts/                 # Kubernetes Helm chart
│   └── status-page/
│       ├── templates/
│       └── values.yaml
│
└── docker-compose.yml      # Local development
```

## API Documentation

When running in debug mode, API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/status/overview` | Global status overview |
| GET | `/v1/components` | List components |
| POST | `/v1/components` | Create component |
| GET | `/v1/incidents` | List incidents |
| POST | `/v1/incidents` | Create incident |
| POST | `/v1/incidents/{id}/updates` | Add incident update |
| POST | `/v1/incidents/{id}/resolve` | Resolve incident |
| GET | `/v1/maintenance` | List maintenance windows |
| POST | `/v1/maintenance` | Schedule maintenance |

## Kubernetes Deployment

```bash
# Install the Helm chart
helm install status-page ./charts/status-page \
  --namespace status \
  --create-namespace \
  --set api.image.repository=your-registry/status-page-api \
  --set frontend.image.repository=your-registry/status-page-frontend

# Upgrade
helm upgrade status-page ./charts/status-page -n status
```

### Required Secrets

Create these secrets before deploying:

```bash
# Database credentials
kubectl create secret generic status-page-db-credentials \
  --from-literal=username=statuspage \
  --from-literal=password=your-password \
  -n status

# TLS certificate (if not using cert-manager)
kubectl create secret tls status-page-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n status
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser   │────▶│   Ingress    │────▶│   Frontend   │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   FastAPI    │────▶│  PostgreSQL  │
                    │     API      │     │              │
                    └──────────────┘     └──────────────┘
```

## License

Internal use only.
