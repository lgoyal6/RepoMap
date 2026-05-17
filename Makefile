# Default target
.PHONY: all
all: run

CLEAN_DIRS = extension/node_modules webview/node_modules extension/dist webview/dist

# Simple run: Install dependencies, build, and package
.PHONY: run
run:
	@echo "🚀 Starting simple run..."
	cd extension && npm install && npm run compile && yes | npm run package
	cd webview && npm install && npm run build
	@echo "✅ Simple run completed!"

# Full run: Clean, then install dependencies, build, and package
.PHONY: full-run
full-run:
	@echo "🔥 Cleaning directories..."
	rm -rf $(CLEAN_DIRS)
	@echo "🚀 Starting full run..."
	cd extension && npm install
	cd webview && npm install
	cd webview && npm run build
	cd extension && npm run compile
	cd extension && yes | npm run package
	@echo "✅ Full run completed!"