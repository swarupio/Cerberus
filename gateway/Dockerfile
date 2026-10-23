FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.js metrics.js admin.js ./

USER node
EXPOSE 3000
CMD ["node", "server.js"]
