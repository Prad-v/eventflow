# Status Page - Makefile
# Build and deploy commands for development and production

.PHONY: help dev build push deploy clean logs test

# Configuration
DOCKER_REGISTRY ?= localhost:5000
IMAGE_TAG ?= latest
K8S_NAMESPACE ?= eventflow
HELM_RELEASE ?= status-page

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

help: ## Show this help
	@echo "$(CYAN)Status Page - Build & Deploy$(RESET)"
	@echo ""
	@echo "$(GREEN)Usage:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

# ============================================================================
# Development
# ============================================================================

dev: ## Start development environment with docker-compose
	docker compose up -d
	@echo "$(GREEN)✓ Development environment started$(RESET)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  API:      http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"

dev-logs: ## Follow development logs
	docker compose logs -f

dev-down: ## Stop development environment
	docker compose down

dev-reset: ## Reset development environment (removes data)
	docker compose down -v
	docker compose up -d --build
	@sleep 5
	docker exec eventflow-api-1 alembic upgrade head
	@echo "$(GREEN)✓ Development environment reset$(RESET)"

# ============================================================================
# Database
# ============================================================================

db-migrate: ## Run database migrations (development)
	docker exec eventflow-api-1 alembic upgrade head
	@echo "$(GREEN)✓ Migrations applied$(RESET)"

db-revision: ## Create new migration revision
	@read -p "Migration message: " msg; \
	docker exec eventflow-api-1 alembic revision --autogenerate -m "$$msg"

db-history: ## Show migration history
	docker exec eventflow-api-1 alembic history

# ============================================================================
# Build
# ============================================================================

build: build-api build-frontend ## Build all Docker images

build-api: ## Build API Docker image
	@echo "$(CYAN)Building API image...$(RESET)"
	docker build -t $(DOCKER_REGISTRY)/status-page-api:$(IMAGE_TAG) ./backend
	@echo "$(GREEN)✓ API image built$(RESET)"

build-frontend: ## Build Frontend Docker image
	@echo "$(CYAN)Building Frontend image...$(RESET)"
	docker build -t $(DOCKER_REGISTRY)/status-page-frontend:$(IMAGE_TAG) ./frontend
	@echo "$(GREEN)✓ Frontend image built$(RESET)"

push: push-api push-frontend ## Push all Docker images

push-api: ## Push API Docker image
	docker push $(DOCKER_REGISTRY)/status-page-api:$(IMAGE_TAG)
	@echo "$(GREEN)✓ API image pushed$(RESET)"

push-frontend: ## Push Frontend Docker image
	docker push $(DOCKER_REGISTRY)/status-page-frontend:$(IMAGE_TAG)
	@echo "$(GREEN)✓ Frontend image pushed$(RESET)"

# ============================================================================
# Kubernetes Deployment
# ============================================================================

k8s-namespace: ## Create Kubernetes namespace
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "$(GREEN)✓ Namespace $(K8S_NAMESPACE) ready$(RESET)"

k8s-secrets: ## Create Kubernetes secrets (interactive)
	@echo "$(YELLOW)Creating database credentials secret...$(RESET)"
	@read -p "Database username: " db_user; \
	read -sp "Database password: " db_pass; echo; \
	kubectl create secret generic status-page-db-credentials \
		--from-literal=username=$$db_user \
		--from-literal=password=$$db_pass \
		-n $(K8S_NAMESPACE) \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "$(GREEN)✓ Secrets created$(RESET)"

deploy: k8s-namespace ## Deploy to Kubernetes using Helm
	@echo "$(CYAN)Deploying to Kubernetes...$(RESET)"
	helm upgrade --install $(HELM_RELEASE) ./charts/status-page \
		--namespace $(K8S_NAMESPACE) \
		--set api.image.repository=$(DOCKER_REGISTRY)/status-page-api \
		--set api.image.tag=$(IMAGE_TAG) \
		--set frontend.image.repository=$(DOCKER_REGISTRY)/status-page-frontend \
		--set frontend.image.tag=$(IMAGE_TAG) \
		--wait
	@echo "$(GREEN)✓ Deployed to $(K8S_NAMESPACE)$(RESET)"

deploy-kind: k8s-namespace ## Deploy to Kind cluster (loads images directly)
	@echo "$(CYAN)Applying dev infrastructure...$(RESET)"
	kubectl apply -f k8s/dev-infra.yaml
	@echo "$(CYAN)Building for Kind...$(RESET)"
	docker build -t status-page-api:$(IMAGE_TAG) ./backend
	docker build -t status-page-frontend:$(IMAGE_TAG) ./frontend
	@echo "$(CYAN)Loading images into Kind cluster '$(K8S_NAMESPACE)'...$(RESET)"
	kind load docker-image status-page-api:$(IMAGE_TAG) --name $(K8S_NAMESPACE)
	kind load docker-image status-page-frontend:$(IMAGE_TAG) --name $(K8S_NAMESPACE)
	@echo "$(CYAN)Deploying to Kind...$(RESET)"
	helm upgrade --install $(HELM_RELEASE) ./charts/status-page \
		--namespace $(K8S_NAMESPACE) \
		--set api.image.repository=status-page-api \
		--set api.image.tag=$(IMAGE_TAG) \
		--set api.image.pullPolicy=Never \
		--set frontend.image.repository=status-page-frontend \
		--set frontend.image.tag=$(IMAGE_TAG) \
		--set frontend.image.pullPolicy=Never \
		--wait
	@echo "$(CYAN)Running migrations...$(RESET)"
	kubectl exec -n $(K8S_NAMESPACE) deployment/$(HELM_RELEASE)-api -- alembic upgrade head
	@echo "$(GREEN)✓ Deployed to Kind cluster $(K8S_NAMESPACE)$(RESET)"

deploy-dry-run: ## Dry-run Helm deployment
	helm upgrade --install $(HELM_RELEASE) ./charts/status-page \
		--namespace $(K8S_NAMESPACE) \
		--set api.image.repository=$(DOCKER_REGISTRY)/status-page-api \
		--set api.image.tag=$(IMAGE_TAG) \
		--set frontend.image.repository=$(DOCKER_REGISTRY)/status-page-frontend \
		--set frontend.image.tag=$(IMAGE_TAG) \
		--dry-run --debug

undeploy: ## Remove Kubernetes deployment
	helm uninstall $(HELM_RELEASE) -n $(K8S_NAMESPACE)
	@echo "$(YELLOW)✓ Deployment removed$(RESET)"

k8s-status: ## Show Kubernetes deployment status
	@echo "$(CYAN)Pods:$(RESET)"
	kubectl get pods -n $(K8S_NAMESPACE)
	@echo ""
	@echo "$(CYAN)Services:$(RESET)"
	kubectl get svc -n $(K8S_NAMESPACE)
	@echo ""
	@echo "$(CYAN)Ingress:$(RESET)"
	kubectl get ingress -n $(K8S_NAMESPACE)

k8s-logs: ## Follow Kubernetes logs
	kubectl logs -f -l app.kubernetes.io/name=status-page -n $(K8S_NAMESPACE) --all-containers

k8s-migrate: ## Run migrations in Kubernetes
	kubectl exec -it deployment/$(HELM_RELEASE)-api -n $(K8S_NAMESPACE) -- alembic upgrade head

# ============================================================================
# Testing & Linting
# ============================================================================

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && python -m pytest -v

test-frontend: ## Run frontend tests
	cd frontend && npm test

lint: lint-backend lint-frontend lint-helm ## Run all linters

lint-backend: ## Lint backend code
	cd backend && python -m ruff check .

lint-frontend: ## Lint frontend code
	cd frontend && npm run lint

lint-helm: ## Lint Helm chart
	helm lint ./charts/status-page

# ============================================================================
# OpenAPI
# ============================================================================

openapi-export: ## Export OpenAPI specification
	@echo "$(CYAN)Exporting OpenAPI spec...$(RESET)"
	curl -s http://localhost:8000/openapi.json | python3 -m json.tool > openapi.json
	@echo "$(GREEN)✓ OpenAPI spec exported to openapi.json$(RESET)"

openapi-validate: ## Validate OpenAPI specification
	@echo "$(CYAN)Validating OpenAPI spec...$(RESET)"
	curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; json.load(sys.stdin); print('Valid JSON')"

# ============================================================================
# Advanced Networking (Istio & VIP)
# ============================================================================

VIP_IP ?= 172.20.0.100

setup-vip: ## Create loopback alias for Virtual IP on MacOS
	@echo "$(CYAN)Setting up Virtual IP $(VIP_IP)...$(RESET)"
	sudo ifconfig lo0 alias $(VIP_IP) 255.255.255.255
	@echo "$(GREEN)✓ VIP $(VIP_IP) created$(RESET)"

teardown-vip: ## Remove loopback alias
	@echo "$(CYAN)Removing Virtual IP $(VIP_IP)...$(RESET)"
	sudo ifconfig lo0 -alias $(VIP_IP)
	@echo "$(GREEN)✓ VIP removed$(RESET)"

deploy-istio: ## Install Istio via Helm
	@echo "$(CYAN)Installing Istio...$(RESET)"
	helm repo add istio https://istio-release.storage.googleapis.com/charts
	helm repo update
	kubectl create namespace istio-system --dry-run=client -o yaml | kubectl apply -f -
	helm upgrade --install istio-base istio/base -n istio-system --wait
	helm upgrade --install istiod istio/istiod -n istio-system --wait
	helm upgrade --install istio-ingressgateway istio/gateway -n istio-system --wait
	@echo "$(GREEN)✓ Istio installed$(RESET)"

tunnel: ## Start Tunnel: VIP -> Istio Ingress Gateway (requires sudo)
	@echo "$(CYAN)Starting Tunnel $(VIP_IP) -> Istio Ingress...$(RESET)"
	@echo "$(YELLOW)⚠️  This command requires sudo for ports 80/443$(RESET)"
	@echo "$(YELLOW)   Run: sudo make tunnel$(RESET)"
	@echo "$(YELLOW)Keep this terminal open!$(RESET)"
	@echo ""
	kubectl port-forward --address $(VIP_IP) -n istio-system svc/istio-ingressgateway 80:80 443:443

# ============================================================================
# E2E Testing
# ============================================================================

test-e2e-setup: ## Install Playwright browsers for E2E testing
	@echo "$(CYAN)Installing Playwright browsers...$(RESET)"
	cd frontend && npm install
	cd frontend && npx playwright install chromium
	@echo "$(GREEN)✓ Playwright setup complete$(RESET)"

test-e2e: ## Run E2E tests against deployed application (requires VIP setup)
	@echo "$(CYAN)Running E2E tests...$(RESET)"
	@echo "$(CYAN)Starting port-forward to Istio Ingress Gateway on VIP...$(RESET)"
	@echo "$(YELLOW)Note: Requires VIP setup (make setup-vip) and /etc/hosts configured$(RESET)"
	@sudo kubectl port-forward --address $(VIP_IP) -n istio-system svc/istio-ingressgateway 80:80 443:443 & \
		PF_PID=$$!; \
		sleep 5; \
		E2E_BASE_URL=https://status.internal.example.com cd frontend && npm run test:e2e; \
		TEST_EXIT=$$?; \
		sudo kill $$PF_PID 2>/dev/null || true; \
		exit $$TEST_EXIT
	@echo "$(GREEN)✓ E2E tests complete$(RESET)"

test-e2e-local: ## Run E2E tests with frontend-only port-forward (limited functionality)
	@echo "$(CYAN)Running E2E tests (frontend only)...$(RESET)"
	@kubectl port-forward -n eventflow svc/status-page-frontend 3000:80 & \
		PF_PID=$$!; \
		sleep 3; \
		cd frontend && npm run test:e2e; \
		TEST_EXIT=$$?; \
		kill $$PF_PID 2>/dev/null || true; \
		exit $$TEST_EXIT
	@echo "$(GREEN)✓ E2E tests complete$(RESET)"

test-e2e-ui: ## Run E2E tests with Playwright UI
	@echo "$(CYAN)Opening Playwright UI...$(RESET)"
	cd frontend && npm run test:e2e:ui

test-e2e-report: ## Show E2E test report
	@echo "$(CYAN)Opening test report...$(RESET)"
	cd frontend && npx playwright show-report

# ============================================================================
# Cleanup
# ============================================================================

clean: ## Clean build artifacts
	rm -rf backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/dist frontend/node_modules/.cache
	docker system prune -f
	@echo "$(GREEN)✓ Cleaned$(RESET)"

clean-all: clean ## Clean everything including node_modules
	rm -rf frontend/node_modules
	rm -rf backend/.venv
	@echo "$(GREEN)✓ Deep cleaned$(RESET)"
