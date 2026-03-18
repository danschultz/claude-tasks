FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY src/ ./src/

ENV TASK_DIR=/tasks
ENV OUTPUT_DIR=/output

USER node

ENTRYPOINT ["node", "--import", "tsx/esm", "src/runner.ts"]
