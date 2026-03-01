FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
COPY prisma.config.ts ./

RUN npm install -D typescript tsx
RUN npx prisma generate

EXPOSE 3000

CMD ["npx", "tsx", "src/app.ts"]
