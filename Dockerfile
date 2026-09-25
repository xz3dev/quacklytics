FROM oven/bun:1.3.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/home/package.json apps/home/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/tracker/package.json packages/tracker/package.json
COPY patches patches
RUN bun install --frozen-lockfile
COPY apps/web apps/web
COPY packages packages
RUN bun run build

FROM oven/bun:1.3.4
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/src/server/gateway.ts ./apps/web/src/server/gateway.ts
COPY --from=build /app/apps/web/src/server/worker-protocol.ts ./apps/web/src/server/worker-protocol.ts
COPY --from=build /app/apps/web/server.ts ./apps/web/server.ts
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
RUN mkdir /data && chown bun:bun /data
USER bun
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD bun -e 'const r=await fetch("http://127.0.0.1:3000/api/health");process.exit(r.ok?0:1)'
CMD ["bun", "server.ts"]
