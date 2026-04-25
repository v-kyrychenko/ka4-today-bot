ESBUILD := ./node_modules/.bin/esbuild
ESBUILD_FLAGS := --bundle --platform=node --format=cjs --target=es2022

build-Ka4TodayTelegramWebhook:
	mkdir -p "$(ARTIFACTS_DIR)/src/modules/telegram/handlers"
	$(ESBUILD) src/modules/telegram/handlers/ka4TodayTelegramWebhook.ts $(ESBUILD_FLAGS) --outfile="$(ARTIFACTS_DIR)/src/modules/telegram/handlers/ka4TodayTelegramWebhook.js"

build-Ka4TodayAsyncTelegramProcessor:
	mkdir -p "$(ARTIFACTS_DIR)/src/modules/telegram/handlers"
	cp -R assets "$(ARTIFACTS_DIR)/assets"
	$(ESBUILD) src/modules/telegram/handlers/asyncTelegramProcessor.ts $(ESBUILD_FLAGS) --external:@resvg/resvg-js --outfile="$(ARTIFACTS_DIR)/src/modules/telegram/handlers/asyncTelegramProcessor.js"

build-Ka4TodayCronDailyMessageFunction:
	mkdir -p "$(ARTIFACTS_DIR)/src/modules/telegram/handlers"
	cp -R assets "$(ARTIFACTS_DIR)/assets"
	$(ESBUILD) src/modules/telegram/handlers/cronDailyMessage.ts $(ESBUILD_FLAGS) --external:@resvg/resvg-js --outfile="$(ARTIFACTS_DIR)/src/modules/telegram/handlers/cronDailyMessage.js"
