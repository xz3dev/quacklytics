
# Base image for building the frontend
FROM node:20-alpine AS frontend-builder

# Set working directory for the frontend
WORKDIR /frontend

# Copy frontend files
COPY /frontend/package*.json ./
COPY /frontend/ ./

# Install dependencies and build the frontend
RUN npm install
RUN npm run build

# Base image for building the backend
FROM golang:1.24.0 AS backend-builder

COPY --from=frontend-builder /backend/server/public/frontend ./backend/server/public/frontend

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory for the backend
WORKDIR /backend

# Copy backend files
COPY /backend/go.* ./
COPY /backend/ ./

# Build Options
ENV CGO_ENABLED=1
ENV GOOS=linux
ENV GOARCH=arm64

# Build the Go application
RUN go build -o app main.go

# Final lightweight image
FROM gcr.io/distroless/cc

# Working directory for the app
WORKDIR /app

# Copy the Go application binary
COPY --from=backend-builder /backend/app .

EXPOSE 3000
ENTRYPOINT ["./app"]
