FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run prisma:generate
RUN npm run build --workspace @autocall-pro/backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=build /workspace/apps/backend/package.json ./apps/backend/package.json
EXPOSE 3001
CMD ["node", "apps/backend/dist/src/main.js"]