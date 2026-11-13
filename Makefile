dev:
	- docker compose down -v
	docker compose up -d --build

deploy:
	docker buildx build -t $(IMAGE):$(TAG) --platform=linux/amd64 --push .
