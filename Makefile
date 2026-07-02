# Makefile — Khârn-Âges list builder
#
# Charge automatiquement la version Node gérée par nvm (le Node système n'a pas npm).
# Surcharger si besoin : make dev NVM_DIR=/autre/chemin

SHELL := /bin/bash
NVM_DIR ?= $(HOME)/.nvm
NODE = source "$(NVM_DIR)/nvm.sh" && nvm use default >/dev/null &&

.DEFAULT_GOAL := help
.PHONY: help install dev test test-watch build typecheck lint preview

help: ## Affiche cette aide
	@echo "Cibles disponibles :"
	@echo "  make install     Installer les dépendances"
	@echo "  make dev         Lancer le serveur de développement (Vite)"
	@echo "  make test        Lancer les tests une fois (Vitest)"
	@echo "  make test-watch  Lancer les tests en mode watch"
	@echo "  make build       Build de production"
	@echo "  make typecheck   Vérification TypeScript"
	@echo "  make lint        Analyse ESLint"
	@echo "  make preview     Prévisualiser le build de production"

install: ## Installer les dépendances
	@$(NODE) npm install

dev: ## Lancer le serveur de développement
	@$(NODE) npm run dev

test: ## Lancer les tests une fois
	@$(NODE) npm test

test-watch: ## Lancer les tests en mode watch
	@$(NODE) npx vitest

build: ## Build de production
	@$(NODE) npm run build

typecheck: ## Vérification TypeScript
	@$(NODE) npm run typecheck

lint: ## Analyse ESLint
	@$(NODE) npm run lint

preview: ## Prévisualiser le build de production
	@$(NODE) npm run preview
