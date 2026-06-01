FROM emscripten/emsdk:5.0.7 AS builder

RUN apt-get update && apt-get install -y git make && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

ARG RAYLIB_COMMIT=e7edb181dc070e0abf90792204b4b6b02bcdd508

RUN wget -O raylib.tar.gz https://github.com/raysan5/raylib/archive/${RAYLIB_COMMIT}.tar.gz \
    && tar -xzf raylib.tar.gz \
    && mv raylib-${RAYLIB_COMMIT} raylib \
    && rm raylib.tar.gz

RUN cd raylib/src && \
    emmake make PLATFORM=PLATFORM_WEB CUSTOM_CFLAGS="-DSUPPORT_FILEFORMAT_JPG=1"

FROM emscripten/emsdk:5.0.7

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

RUN mkdir -p /opt/raylib/src

COPY --from=builder /opt/raylib/src/libraylib.web.a /opt/raylib/src/libraylib.a
COPY --from=builder /opt/raylib/src/raylib.h /opt/raylib/src/
COPY --from=builder /opt/raylib/src/raymath.h /opt/raylib/src/
COPY --from=builder /opt/raylib/src/rlgl.h /opt/raylib/src/

COPY build.sh /usr/local/bin/build_game.sh
RUN chmod +x /usr/local/bin/build_game.sh

RUN chown -R appuser:appgroup /opt/raylib /usr/local/bin/build_game.sh

WORKDIR /src
RUN chown appuser:appgroup /src

USER appuser

CMD ["/bin/bash", "/usr/local/bin/build_game.sh"]