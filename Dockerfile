FROM node:18-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Runtime data dirs (db.json, users.json, AI model, uploaded photos).
# Persist with a volume so data survives container restarts.
RUN mkdir -p /app/data /app/public/uploads \
 && chown -R node:node /app/data /app/public/uploads

USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
