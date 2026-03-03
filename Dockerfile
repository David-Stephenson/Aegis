FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN bun install

FROM base AS prod-deps
COPY package.json ./
RUN bun install --production

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["bun", "run", "build/index.js"]
