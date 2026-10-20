FROM python:3.12.8-slim-bookworm

RUN groupadd --gid 10001 codex \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin codex

WORKDIR /workspace
COPY offline_probe.py /opt/safe-codex/offline_probe.py
USER 10001:10001
ENTRYPOINT ["python", "/opt/safe-codex/offline_probe.py"]
