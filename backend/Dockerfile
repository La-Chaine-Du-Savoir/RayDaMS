FROM denoland/deno:alpine-2.7.14

WORKDIR /app

COPY deno.json deno.lock ./

COPY frontend/deno.json ./frontend/

WORKDIR /app/backend
COPY backend/deno.json ./

RUN deno install --frozen

COPY backend/src ./src
COPY backend/migrations ./migrations

EXPOSE 3000

CMD ["deno", "task", "dev"]