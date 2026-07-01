.PHONY: diff destroy bootstrap dev test start-docker

## Preview infrastructure changes (safe, read-only)
diff:
	npx cdk diff

## Tear down everything — AppStack first (depends on Persistent), then Persistent
destroy:
	npx cdk destroy AppStack --force
	npx cdk destroy PersistentStack --force

bootstrap:
	npx cdk bootstrap

dev:
	npm run start:dev

test:
	npm test

start-docker:
	docker compose up
