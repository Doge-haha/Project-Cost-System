.PHONY: help
help:
	@echo "Available targets:"
	@echo "  dev-deps-up        Start local PostgreSQL and Redis with health checks"
	@echo "  dev-deps-down      Stop local PostgreSQL and Redis"
	@echo "  api-live-db        Run the API live Postgres smoke test"
	@echo "  test               Run the full workspace test suite"
	@echo "  typecheck          Run the full workspace typecheck"

.PHONY: dev-deps-up
dev-deps-up:
	docker compose -f deploy/docker/docker-compose.dev.yml up -d --wait

.PHONY: dev-deps-down
dev-deps-down:
	docker compose -f deploy/docker/docker-compose.dev.yml down

.PHONY: api-live-db
api-live-db:
	DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing npm --workspace @saas-pricing/api run test:live-db

.PHONY: test
test:
	npm test

.PHONY: typecheck
typecheck:
	npm run typecheck
