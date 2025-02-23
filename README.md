# This is _Quacklytics_ 🦆

_Quacklytics_ is an open-source analytics service built using **DuckDB** and designed to run analytical queries directly inside
your browser. It provides a seamless, lightweight, and high-performance way to process your data without the need for
expensive server-side compute resources.

## Why does this exist?

**Save Resources**: Leverage your existing computers performance by running analytical queries entirely in the browser.  
**Easy to Deploy**: One Binary / Docker Image: No need to install or manage a database. All data is stored in simple files on your filesystem by leveraging sqlite and duckdb.
**Open Source**: Free to use and extend.
**Cheap**: Storage is cheap, compute is expensive. That's why everything is a file and as much work happens inside the browser as possible.

## Getting Started

Currently only deployment via docker is supported. Single binaries will be available at a later stage.

### Preparations (required for both methods)

You must create an empty configuration file called `application.conf` in your working directory.

```shell
touch application.conf
```

This file will be populated with the default config on first start.
If you want to modify the config before that, you can grab
the [default config](backend/config/default.conf) from the git repo.

### Architecture
There are 2 image variants: ARM64 and AMD64. Choose whatever you need depending on your servers architecture:
- `ghcr.io/xz3dev/quacklytics/amd64` for Intel/AMD based CPUs
- `ghcr.io/xz3dev/quacklytics/arm64` for ARM / Apple Silicon based CPUs

### Using Docker Compose
```yaml
services:
  quacklytics:
    image: ghcr.io/xz3dev/quacklytics/amd64:latest # arm64 or amd64
    ports:
      - "3001:3000"
    volumes:
      - data:/_data
      - tmp:/_tmp


volumes:
  data:
  tmp:
```

### Using Docker Run

```shell
docker run -d \
  -p 3001:3000 \
  -v data:/_data \
  -v tmp:/_tmp \
  --name quacklytics \
  ghcr.io/xz3dev/quacklytics/amd64:latest
```

## Sending Data

The **AppendEvent** endpoint allows you to send an event to the server for processing. The endpoint is defined as a **POST** request and expects a JSON payload that follows the `EventInput` structure. Additionally, the URL includes a project identifier as a parameter.

### Endpoint URL

Replace `{projectid}` with your actual project identifier.

```
POST /api/{projectid}/event
```

### Request Format

Replace `{projectid}` with your actual project identifier.

**Request Headers**

- **Content-Type:** `application/json`

**Request Body**

The endpoint accepts an array of events as payload. The payload should include the following fields:

- **eventType**: The type of event (e.g., `"user_signup"`).
- **userId**: The unique identifier of the person related to the event. Can be null if unknown.
- **distinctId**: A distinct identifier for the session. This can later be connected to a userId if subsequent events are sent with a userId.
- **timestamp** (ISO 8601 datetime): The time when the event occurred.
- **properties**: A map of additional properties. This is stored as JSON and can be queried. 

### Example

```json
{
  "eventType": "user_signup",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "distinctId": "unique_user_123",
  "timestamp": "2025-02-23T10:00:00Z",
  "properties": {
    "plan": "premium",
    "referrer": "google"
  }
}
```

## Contributing

We welcome contributions from the community! If you'd like to contribute:

1. Fork the repository.
2. Make your changes.
3. Submit a pull request.

Please make sure to follow our [contribution guidelines](CONTRIBUTING.md).

## License

Quacklytics is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Screenshots

![Screenshot](docs/screenshots/insight.png)
![Screenshot](docs/screenshots/dashboard.png)

---
```
Happy Quacking! 🦆
```
