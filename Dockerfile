FROM node:22-alpine

WORKDIR /app

EXPOSE 3000

ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

COPY ./package.json ./yarn.lock ./

RUN yarn

COPY ./ ./

RUN yarn build

USER node

CMD [ "yarn", "start" ]
