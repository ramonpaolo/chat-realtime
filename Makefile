dev:
	- docker compose down -v
	docker compose up -d --build

deploy:
	docker buildx build --build-arg ENV=production -t $(IMAGE):$(TAG) --platform=linux/amd64 --push .
