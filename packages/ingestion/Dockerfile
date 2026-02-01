FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create data directory for state file
RUN mkdir -p /data

CMD ["npm", "start"]
