# Mock PagerDuty User Guide

This guide explains how to use the Mock PagerDuty service for testing the datasource integration without a real PagerDuty account.

## Overview

The Mock PagerDuty service simulates the PagerDuty API v2, providing:
- Mock user authentication
- 8 pre-generated mock incidents
- Support for incident status updates

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make deploy-mock-pd` | Build and deploy Mock PagerDuty to Kind cluster |
| `make undeploy-mock-pd` | Remove Mock PagerDuty deployment |
| `make mock-pd-logs` | Follow Mock PagerDuty container logs |
| `make build-mock-pd` | Build the Docker image only |

### Deploy Mock PagerDuty

```bash
make deploy-mock-pd
```

This command:
1. Builds the `mock-pagerduty` Docker image
2. Loads it into the Kind cluster
3. Deploys via Helm to the `eventflow` namespace

## Configuration

### API Key

The mock service accepts the following API keys:
- `mock-pd-api-key-12345` (default)
- `test-api-key`

### Service URL

When deployed in the cluster, the mock service is accessible at:
```
http://mock-pagerduty
```

## Setting Up in Status Page

1. Navigate to **Settings → Integrations → Datasources**

2. Click **+ Add Datasource**

3. Fill in the form:
   | Field | Value |
   |-------|-------|
   | Name | `Mock PagerDuty` |
   | Provider | `PagerDuty` |
   | API Key | `mock-pd-api-key-12345` |
   | API Endpoint URL | `http://mock-pagerduty` |

4. Click **Create**

5. Click **Test** to verify connection
   - Expected: "Connected as Mock Admin (admin@mock-pagerduty.local)"

6. Click **Enable** to activate the datasource

7. Click **Sync Now** to import mock incidents

## Mock Data

### User
```json
{
  "id": "PUSER01",
  "name": "Mock Admin",
  "email": "admin@mock-pagerduty.local"
}
```

### Mock Incidents

| ID | Title | Status |
|----|-------|--------|
| PINC001 | High CPU usage on production servers | acknowledged |
| PINC002 | Database connection timeout | acknowledged |
| PINC003 | API response time degraded | triggered |
| PINC004 | Memory leak detected in worker nodes | acknowledged |
| PINC005 | SSL certificate expiring soon | acknowledged |
| PINC006 | Disk space running low on storage cluster | resolved |
| PINC007 | Network latency spike detected | resolved |
| PINC008 | Service health check failing | resolved |

### Mock Services

| ID | Name |
|----|------|
| PSVC001 | API Gateway |
| PSVC002 | Database Cluster |
| PSVC003 | Auth Service |

## API Endpoints

The mock service exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/healthz` | Health check |
| GET | `/users/me` | Current user (auth required) |
| GET | `/incidents` | List incidents (auth required) |
| GET | `/services` | List services (auth required) |
| POST | `/incidents` | Create test incident |
| POST | `/incidents/{id}/resolve` | Resolve incident |
| POST | `/incidents/{id}/acknowledge` | Acknowledge incident |
| POST | `/reset` | Reset mock data to initial state |

## Troubleshooting

### Test Connection Fails

1. Verify mock-pagerduty pod is running:
   ```bash
   kubectl get pods -n eventflow | grep mock-pagerduty
   ```

2. Check logs:
   ```bash
   make mock-pd-logs
   ```

### No Incidents Synced

1. Ensure the datasource is **Enabled**
2. Check the **API Endpoint URL** is `http://mock-pagerduty` (no trailing slash)
3. Verify API key is `mock-pd-api-key-12345`

### Reset Mock Data

To reset incidents to their initial state:
```bash
kubectl exec -n eventflow deploy/mock-pagerduty -- curl -X POST http://localhost:8080/reset
```
