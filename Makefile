SHELL := /bin/bash
VERSION ?=

.PHONY: help test lint check release release-dry

help:
	@echo "make test                       run unit tests"
	@echo "make lint                       run eslint + knip"
	@echo "make check                      lint + test"
	@echo "make release VERSION=x.y.z      one-command release (bump, tag, push, release, tap bump)"
	@echo "make release-dry VERSION=x.y.z  same, but only print what would happen"
	@echo
	@echo "See RELEASING.md for the full process."

test:
	npm test

lint:
	npm run lint

check: lint test

release:
	@test -n "$(VERSION)" || { echo "usage: make release VERSION=1.0.1"; exit 1; }
	@bash scripts/release.sh "$(VERSION)"

release-dry:
	@test -n "$(VERSION)" || { echo "usage: make release-dry VERSION=1.0.1"; exit 1; }
	@DRY_RUN=1 bash scripts/release.sh "$(VERSION)"
