FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host binds Vite to 0.0.0.0 so it's reachable from outside the container
CMD ["npm", "run", "dev", "--", "--host"]
