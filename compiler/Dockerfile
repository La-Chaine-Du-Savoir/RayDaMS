FROM emscripten/emsdk:5.0.7 AS builder

RUN apt-get update && apt-get install -y git make && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --depth 1 --branch 5.5 https://github.com/raysan5/raylib.git

RUN cd raylib/src && \
    emmake make PLATFORM=PLATFORM_WEB CUSTOM_CFLAGS="-DSUPPORT_FILEFORMAT_JPG=1"

FROM emscripten/emsdk:5.0.7

COPY --from=builder /opt/raylib/src/libraylib.web.a /opt/raylib/src/libraylib.a
COPY --from=builder /opt/raylib/src/*.h /opt/raylib/src/
COPY build.sh /usr/local/bin/

WORKDIR /src

CMD ["sh", "/usr/local/bin/build.sh"]