# Dockerfile (frontend)
FROM node:18

WORKDIR /app

# Add node_modules/.bin to PATH
ENV PATH="/app/node_modules/.bin:$PATH"

COPY package.json ./
COPY package-lock.json ./
RUN npm install

COPY . .

CMD ["npx", "react-scripts", "start"]
