FROM golang:1.23.1-alpine as build
LABEL authors="xz3dev"
WORKDIR /app
COPY . .

RUN apk add build-base

RUN go mod download
RUN CGO_ENABLED=1 GOOS=linux go build -o app-executable

FROM alpine:latest as runtime

RUN apk add --update wget\
   && rm -rf /var/cache/apk/*

COPY --from=build /app/app-executable /
EXPOSE 8090
ENTRYPOINT ["/app-executable"]
