# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (including devDependencies for build)
COPY package*.json ./
RUN npm install --include=dev

# Copy source and build
COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: SPA routing + gzip + security headers
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
