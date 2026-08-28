# Stage 1: Build static assets
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
RUN node -e "const fs = require('fs'); const file = 'node_modules/zpl2svg/zpl2svg.js'; let content = fs.readFileSync(file, 'utf8'); content = content.replace('pako = require(\'pako\')', 'pako = require(\'pako\'); return pako;'); fs.writeFileSync(file, content);"
COPY . .
RUN npm run build

# Stage 2: Serve static assets with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
