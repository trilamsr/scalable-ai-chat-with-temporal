.PHONY: dev dev-build dev-down prod prod-build prod-down logs clean help

# Development commands
reset: ## Start development environment with hot-reloading
	make dev-down && make dev-build

dev-build: ## Build and start development environment
	docker-compose -f docker-compose.dev.yml up --build

dev-down: ## Stop development environment
	docker-compose -f docker-compose.dev.yml down

# Production commands
prod: ## Start production environment
	docker-compose up

prod-build: ## Build and start production environment
	docker-compose up --build

prod-down: ## Stop production environment
	docker-compose down

# Utility commands
logs: ## View logs from all services
	docker-compose -f docker-compose.dev.yml logs -f

logs-backend: ## View backend logs only
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-frontend: ## View frontend logs only
	docker-compose -f docker-compose.dev.yml logs -f frontend

clean: ## Remove all containers, volumes, and images
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose down -v
	docker system prune -f

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
