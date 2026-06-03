FROM python:3.12-slim

RUN python3 -m pip install --no-cache-dir flask gunicorn

WORKDIR /sim-service
COPY server.py .
COPY runtime_package.py .

EXPOSE 8770

ENTRYPOINT ["gunicorn", "-w", "2", "-b", "0.0.0.0:8770", "--timeout", "180", "server:app"]
