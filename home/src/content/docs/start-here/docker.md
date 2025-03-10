---
title: Deployment using Docker
---

Currently only deployment via docker is supported. Single binaries will be available at a later stage.

## Step 1: Create a configuration file
You must create an empty configuration file called `application.conf` in your current working directory.

```shell
touch application.conf
```

This file will be populated with the default config on first start.
If you want to modify the config before that, you can grab
the [default config](https://github.com/xz3dev/quacklytics/blob/master/backend/config/default.conf) from the git repo.

The configuration is written in [HOCON (Human-Optimized Config Object Notation)](https://github.com/lightbend/config/blob/main/HOCON.md#hocon-human-optimized-config-object-notation).

## Step 2: Deployment

You can either run the image using `docker run` or deploy it using `docker compose`.

**There are 2 image variants:** AMD64 and ARM64. Choose whatever you need depending on your servers cpu-architecture:
- `ghcr.io/xz3dev/quacklytics/amd64` for Intel / AMD based CPUs
- `ghcr.io/xz3dev/quacklytics/arm64` for ARM / Apple Silicon based CPUs

### Step 2.1: Using Docker Run

Replace `$architecture` with either `arm64` or `amd64`.

Executing this command will:
- Bind the application to port 3001
- Create a volume data.
- Create a volume tmp.
- Mount the config you created in step 1
- Assign the name `quacklytics` to the container

```shell

docker run -d \
  -p 3001:3000 \
  -v ./application.conf:/app/application.conf \
  -v data:/_data \
  -v tmp:/_tmp \
  --name quacklytics \
  ghcr.io/xz3dev/quacklytics/$architecture:latest
```

### Step 2.2: Using Docker Compose

This is an example minimal configuration to run Quacklytics using docker compose.  

Replace `$architecture` with either `arm64` or `amd64`.

```yaml
services:
  quacklytics:
    image: ghcr.io/xz3dev/quacklytics/$architecture:latest # arm64 or amd64
    ports:
      - "3001:3000"
    volumes:
      - data:/_data
      - tmp:/_tmp
      - ./application.conf:/app/application.conf

volumes:
  data:
  tmp:
```
