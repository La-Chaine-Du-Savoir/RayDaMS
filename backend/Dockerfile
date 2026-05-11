FROM denoland/deno:alpine-2.7.14

WORKDIR /app

COPY deno.json deno.lock ./

RUN deno install --frozen

EXPOSE 3000

CMD ["deno", "task", "dev"]