FROM emscripten/emsdk:3.1.74

RUN python3 -m pip install flask gunicorn --break-system-packages

WORKDIR /sim-service
COPY server.py .
COPY runtime_package.py .

EXPOSE 8770

ENTRYPOINT ["gunicorn", "-w", "2", "-b", "0.0.0.0:8770", "--timeout", "180", "server:app"]
