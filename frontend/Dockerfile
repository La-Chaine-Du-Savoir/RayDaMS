FROM denoland/deno:alpine-2.7.14

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY deno.json deno.lock ./

COPY ./backend/deno.json ./backend/

WORKDIR /app/frontend
COPY frontend/deno.json ./

RUN deno install --frozen

COPY --chown=appuser:appgroup frontend/src ./src

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5173

CMD ["deno", "task", "start"]