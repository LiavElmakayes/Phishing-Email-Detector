FROM node:18

RUN apt-get update && apt-get install -y spamassassin

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]