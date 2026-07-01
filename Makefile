.PHONY: deploy deploy-lambda synth bootstrap dev test start-docker

deploy:
	npx cdk deploy --require-approval never

deploy-lambda:
	npx cdk deploy --require-approval never

synth:
	npx cdk synth

bootstrap:
	npx cdk bootstrap

dev:
	npm run start:dev

test:
	npm test

start-docker:
	docker compose up
