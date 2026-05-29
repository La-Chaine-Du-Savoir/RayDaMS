FROM denoland/deno:alpine-2.7.14

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY deno.json deno.lock ./
COPY frontend/deno.json ./frontend/

WORKDIR /app/backend
COPY backend/deno.json ./

RUN deno install --frozen

RUN chown -R appuser:appgroup /app /deno-dir

USER appuser

COPY --chown=appuser:appgroup backend/src ./src
COPY --chown=appuser:appgroup backend/migrations ./migrations

EXPOSE 3000

CMD ["deno", "task", "dev"]