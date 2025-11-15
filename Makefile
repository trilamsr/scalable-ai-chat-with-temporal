.PHONY: help install build clean lint dev prod logs health
.DEFAULT_GOAL := help

lint:
	npm run lint

lint-fix:
	npm run lint:fix

type-check: build-shared
	cd backend && npx tsc --noEmit
	cd frontend && npx tsc --noEmit

dev:
	docker-compose -f docker-compose.dev.yml up

dev-build:
	docker-compose -f docker-compose.dev.yml up --build

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-restart: dev-down dev-build

prod:
	docker-compose up

prod-build:
	docker-compose up --build

prod-down:
	docker-compose down

prod-restart: prod-down prod-build

logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-prod:
	docker-compose logs -f

logs-backend:
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-frontend:
	docker-compose -f docker-compose.dev.yml logs -f frontend

health:
	@curl -s http://localhost:4000/health | jq '.'

docker-ps:
	@docker-compose ps

clean:
	rm -rf backend/dist frontend/dist shared/dist

clean-deps:
	npm run clean

clean-docker:
	docker-compose -f docker-compose.dev.yml down -v

clean-docker-prod:
	docker-compose down -v

clean-all: clean-deps clean clean-docker clean-docker-prod
	docker system prune -f

reset-dev: dev-down clean-docker dev-build

reset-prod: prod-down clean-docker-prod prod-build

redis-cli:
	docker exec -it chat-redis redis-cli

redis-flush:
	docker exec -it chat-redis redis-cli FLUSHALL

postgres-cli:
	docker exec -it chat-postgres psql -U temporal -d temporal
