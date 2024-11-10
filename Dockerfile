FROM node:22-alpine AS builder

WORKDIR /app

EXPOSE 3000

ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

COPY ./package.json ./yarn.lock ./

RUN yarn

COPY ./ ./

RUN yarn build

FROM node:22-alpine

WORKDIR /app

EXPOSE 3000

COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/dist ./dist

RUN yarn --production

USER node

CMD [ "yarn", "start" ]
