# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace=@parts-inventory-system/frontend --include-workspace-root

COPY frontend ./frontend
RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
