FROM denoland/deno:alpine-2.7.14

WORKDIR /app
COPY deno.json deno.lock ./

COPY ./backend/deno.json ./backend/

WORKDIR /app/frontend
COPY frontend/deno.json ./

RUN deno install --frozen

COPY frontend/src ./src

EXPOSE 5173

CMD ["deno", "task", "start"]