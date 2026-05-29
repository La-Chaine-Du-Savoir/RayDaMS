FROM emscripten/emsdk:5.0.7 AS builder

RUN apt-get update && apt-get install -y git make && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

COPY compiler/raylib/ ./raylib/

RUN cd raylib/src && \
    emmake make PLATFORM=PLATFORM_WEB CUSTOM_CFLAGS="-DSUPPORT_FILEFORMAT_JPG=1"

FROM emscripten/emsdk:5.0.7

RUN mkdir -p /opt/raylib/src

COPY --from=builder /opt/raylib/src/libraylib.web.a /opt/raylib/src/libraylib.a
COPY --from=builder /opt/raylib/src/raylib.h /opt/raylib/src/
COPY --from=builder /opt/raylib/src/raymath.h /opt/raylib/src/
COPY --from=builder /opt/raylib/src/rlgl.h /opt/raylib/src/

COPY build.sh /usr/local/bin/build_game.sh
RUN chmod +x /usr/local/bin/build_game.sh

WORKDIR /src

CMD ["/bin/bash", "/usr/local/bin/build_game.sh"]