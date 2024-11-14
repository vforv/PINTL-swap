FROM node:20-alpine

RUN apk --no-cache add curl

# Create app directory
RUN mkdir -p /home/app
WORKDIR /home/app

# Install app dependencies
COPY package.json /home/app
COPY package-lock.json /home/app
RUN npm install --force;

# Bundle app source
COPY . /home/app
RUN npm run build;

EXPOSE 8080
CMD npm run server
