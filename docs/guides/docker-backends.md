# Docker Backends

Use this setup when you want to keep frontend development on Vite while moving
the heavy build environments into Docker.

```bash
docker compose -f deploy/docker-compose.backends.yml up -d --build
```

If Docker needs to use the host proxy, pass it explicitly:

```bash
VIBEBOARD_DOCKER_PROXY=http://host.docker.internal:7897 \
  docker compose -f deploy/docker-compose.backends.yml up -d --build
```

Use `socks5h://host.docker.internal:<port>` instead if the proxy port only
speaks SOCKS5. For mixed HTTP/SOCKS proxy ports, the `http://` form is usually
right for `apt`, `pip`, and `git`.

Services:

```text
ESP-IDF compiler service: http://127.0.0.1:8760
Huangshan service:        http://127.0.0.1:8771
Frontend dev server:      npm run dev, then http://localhost:5173
```

Health checks:

```bash
curl http://127.0.0.1:8760/health
curl http://127.0.0.1:8771/huangshan/health
```

The Huangshan container mounts the local SiFli SDK and Huangshan workspace from
`hardware/huangshan/`, but installs Linux SiFli tools into the
`vibeboard-sifli-tools` Docker volume. The first start can take a while because
it downloads the Linux toolchain.

On macOS, keep Huangshan USB flashing and serial monitoring on the host unless
you have a known Docker USB forwarding setup. Docker Desktop does not expose
`/dev/cu.usbserial-*` like a native Linux host.
