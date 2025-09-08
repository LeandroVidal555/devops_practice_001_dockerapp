FROM node:24-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install
RUN echo "change"

CMD [ "npm", "start" ]
