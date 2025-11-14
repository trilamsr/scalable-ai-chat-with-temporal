.PHONY: dev dev-build dev-down prod prod-build prod-down logs clean npm-clean help

reset:
	make dev-down && make dev-build
# Development
dev: ## Start development environment
	docker-compose -f docker-compose.dev.yml up

dev-build: ## Build and start development environment
	docker-compose -f docker-compose.dev.yml up --build

dev-down: ## Stop development environment
	docker-compose -f docker-compose.dev.yml down

# Production
prod: ## Start production environment
	docker-compose up

prod-build: ## Build and start production environment
	docker-compose up --build

prod-down: ## Stop production environment
	docker-compose down

# Utilities
logs: ## View all service logs
	docker-compose -f docker-compose.dev.yml logs -f

clean: ## Remove all containers, volumes, and prune system
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose down -v
	docker system prune -f

npm-clean: ## Remove all node_modules directories
	npm run clean

help: ## Show available commands
	@echo 'Usage: make [target]'
	@echo ''
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
