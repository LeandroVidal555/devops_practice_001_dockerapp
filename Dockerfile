FROM node:24-alpine

WORKDIR /usr/src/app

# keep compiled packages in a separate layer
COPY package*.json ./
RUN npm ci

COPY . .

# for documentation only:
EXPOSE 3000
CMD [ "npm", "start" ]