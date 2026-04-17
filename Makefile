APP_BACKEND=apps/backend

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  backend-test      Run backend tests"
	@echo "  backend-run       Run backend app"

.PHONY: backend-test
backend-test:
	./gradlew :apps:backend:test

.PHONY: backend-run
backend-run:
	./gradlew :apps:backend:bootRun

