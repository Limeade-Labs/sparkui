FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3456
ENV NODE_ENV=production
ENV PORT=3456
CMD ["node", "server.js"]
