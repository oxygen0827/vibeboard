# VibeBoard HTTPS USB Flash Deployment

Browser USB flashing uses Web Serial, so the page must run in a secure browser
context. Plain public HTTP FRP links are not enough.

## Current Deployed Entry

```text
https://fireplace-verification-holder-properties.trycloudflare.com
```

This is a Cloudflare Quick Tunnel running on the 4060Ti home server. It proxies
to the existing VibeBoard service:

```text
Cloudflare HTTPS -> cloudflared on 4060Ti -> http://127.0.0.1:4100
```

Server files:

```text
/home/wq/bin/cloudflared
/home/wq/.config/systemd/user/vibeboard-cloudflared.service
/home/wq/vibeboard-deploy/cloudflared-vibeboard.log
/home/wq/vibeboard-deploy/HTTPS-USB-FLASH.md
```

Operational commands on the 4060Ti server:

```bash
systemctl --user status vibeboard-cloudflared.service
systemctl --user restart vibeboard-cloudflared.service
tail -80 /home/wq/vibeboard-deploy/cloudflared-vibeboard.log
```

## Why Not Current FRP HTTP

The existing public VibeBoard entry is:

```text
http://150.158.146.192:6054/
```

It works for normal web access, build, official examples, OTA controls, and
downloads. It cannot enable Web Serial because Chrome and Edge require
`window.isSecureContext` for `navigator.serial`.

The current frps server exposes TCP ports only:

```text
vhostHTTPPort = 0
vhostHTTPSPort = 0
allowed ports = 6000-6299,7001-7499,7501-7999,8200-8210,10000-20000
```

That can forward a port, but it does not terminate trusted HTTPS by itself.

## Permanent Production Path

For a stable branded URL, replace the Quick Tunnel with one of these:

1. Configure frps with `vhostHTTPSPort = 443` and use FRP `type = "https"` with
   a real domain.
2. Use FRP TCP to pass public `443` to a home-server Caddy or nginx HTTPS
   endpoint.
3. Use a Cloudflare named tunnel bound to a real domain.

Until one of those exists, the Quick Tunnel is the deployed HTTPS path for USB
flashing. Quick Tunnel URLs can change after service restart; the latest URL is
printed in `cloudflared-vibeboard.log`.
