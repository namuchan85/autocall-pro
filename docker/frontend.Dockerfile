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
RUN npm run build --workspace @autocall-pro/frontend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /workspace/apps/frontend/public ./apps/frontend/public
COPY --from=build /workspace/apps/frontend/package.json ./apps/frontend/package.json
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@autocall-pro/frontend"]