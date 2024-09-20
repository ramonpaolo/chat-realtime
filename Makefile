dev:
	- docker compose down -v
	docker compose up -d --build

deploy:
	docker buildx build --build-arg ENV=production -t r4deu51/chat-realtime:latest --platform=linux/amd64 --push .
