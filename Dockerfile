FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
# For Vite output use /dist. For CRA it would be /build.
COPY --from=build /app/dist /usr/share/nginx/html
# SPA routing: all paths serve index.html (needed for React Router on direct URL access)
COPY nginx.conf /etc/nginx/conf.d/default.conf

