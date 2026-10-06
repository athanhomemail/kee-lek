FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node backend/src ./src
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
