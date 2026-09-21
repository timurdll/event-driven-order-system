# Event-Driven Order Processing System

Учебный проект для лабораторной работы «Event-Driven Microservices Architecture and CI/CD».

Простая асинхронная система обработки заказов из трёх независимых сервисов, обменивающихся событиями через RabbitMQ, с распределённой трассировкой (OpenTelemetry + Jaeger) и CI/CD на GitHub Actions.

## 1. Обзор системы

| Сервис | Роль | Взаимодействие |
|---|---|---|
| **Order Service** | Принимает REST-запрос на создание заказа, сохраняет его в памяти (in-memory store) и публикует событие `order.created` в брокер сообщений. | HTTP (входящий), AMQP (исходящий, publish) |
| **Message Broker (RabbitMQ)** | Топик-обменник `orders_exchange` с routing key `order.created`. Гарантирует доставку событий обоим подписчикам (durable-очереди, publisher confirms). | AMQP |
| **Payment Service** | Подписывается на очередь `payment_queue`, асинхронно "обрабатывает" оплату заказа (эмуляция с задержкой и случайным исходом). | AMQP (входящий, consume) |
| **Inventory Service** | Подписывается на очередь `inventory_queue`, параллельно с Payment Service списывает товары со склада. | AMQP (входящий, consume) |
| **Jaeger** | Собирает и визуализирует распределённые трейсы всех трёх сервисов (OTLP). | OTLP/HTTP |

Payment Service и Inventory Service не обращаются к Order Service по HTTP напрямую — они полностью развязаны (decoupled) и общаются только через события.

### Архитектурная схема

```
                    HTTP POST /orders
                          │
                          ▼
                 ┌──────────────────┐
                 │   Order Service   │──── stores order (in-memory)
                 └────────┬──────────┘
                          │ publish "order.created"
                          ▼
                 ┌──────────────────┐
                 │ RabbitMQ Exchange │  orders_exchange (topic)
                 │  routing key:     │
                 │  order.created    │
                 └───┬──────────┬────┘
                     │          │
        payment_queue│          │inventory_queue
                     ▼          ▼
          ┌──────────────┐  ┌──────────────────┐
          │Payment Service│  │Inventory Service │
          └──────────────┘  └──────────────────┘

   traceparent header propagated: HTTP → AMQP → consumers
                          │
                          ▼
                 ┌──────────────────┐
                 │      Jaeger       │  (single trace per order,
                 │  (OTLP receiver)  │   spans from all 3 services)
                 └──────────────────┘
```

## 2. REST API спецификация (Order Service)

### `POST /orders`

Создаёт новый заказ и публикует событие `order.created`.

**Request body:**

```json
{
  "userId": "u-123",
  "items": [
    { "sku": "SKU-001", "name": "Wireless Mouse", "quantity": 2, "price": 19.99 },
    { "sku": "SKU-002", "name": "USB-C Cable", "quantity": 1, "price": 9.99 }
  ]
}
```

**Response `201 Created`:**

```json
{
  "orderId": "3f2a9c3e-1b2d-4c9a-9e2a-8f1a2b3c4d5e",
  "userId": "u-123",
  "status": "CREATED",
  "totalAmount": 49.97,
  "items": [ ... ],
  "createdAt": "2026-09-21T10:15:30.000Z"
}
```

### `GET /orders/:orderId`

Возвращает текущее состояние заказа (для проверки, что Payment/Inventory обработали событие — сервисы обновляют статус заказа только в своей локальной памяти/логах; в данном учебном варианте Order Service отдаёт последний известный статус, сохранённый на момент создания, что и демонстрирует асинхронность).

### `GET /health`

Health-check, используется в docker-compose и integration-тестах CI.

## 3. Схема события `order.created`

Публикуется в `orders_exchange` с routing key `order.created`. Контекст трассировки передаётся в AMQP headers (`traceparent`, W3C Trace Context) — это и есть механизм сквозной трассировки через брокер.

```json
{
  "eventType": "order.created",
  "eventId": "b7e6c1a0-...",
  "orderId": "3f2a9c3e-...",
  "userId": "u-123",
  "totalAmount": 49.97,
  "items": [
    { "sku": "SKU-001", "name": "Wireless Mouse", "quantity": 2, "price": 19.99 }
  ],
  "timestamp": "2026-09-21T10:15:30.000Z"
}
```

| Поле | Тип | Описание |
|---|---|---|
| `eventType` | string | Тип события, всегда `order.created` |
| `eventId` | string (UUID) | Уникальный идентификатор события (идемпотентность) |
| `orderId` | string (UUID) | Идентификатор заказа |
| `userId` | string | Идентификатор пользователя |
| `totalAmount` | number | Сумма заказа |
| `items` | array | Список позиций заказа (sku, name, quantity, price) |
| `timestamp` | string (ISO-8601) | Время создания события |

## 4. Структура репозитория

```
.
├── order-service/        # Express REST API, публикует события
├── payment-service/      # consumer, обрабатывает оплату
├── inventory-service/    # consumer, обновляет остатки склада
├── docker-compose.yml    # rabbitmq + jaeger + 3 сервиса
└── .github/workflows/    # CI/CD pipeline
```

Каждый сервис — независимое Node.js приложение со своим `Dockerfile` (multi-stage build) и `package.json`.

## 5. Запуск локально

```bash
docker compose up --build
```

- Order Service: http://localhost:3001
- Payment Service (health/metrics): http://localhost:3002
- Inventory Service (health/metrics): http://localhost:3003
- RabbitMQ management UI: http://localhost:15672 (guest/guest)
- Jaeger UI: http://localhost:16686

### Пример запроса

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u-123",
    "items": [
      { "sku": "SKU-001", "name": "Wireless Mouse", "quantity": 2, "price": 19.99 }
    ]
  }'
```

Затем откройте Jaeger UI (http://localhost:16686), выберите сервис `order-service` и найдите трейс — в нём будут видны спаны от `order-service`, `payment-service` и `inventory-service`, связанные единым `traceId`.

## 6. Тесты

Каждый сервис содержит unit-тесты (Jest) и linting (ESLint). Запуск:

```bash
cd order-service && npm ci && npm run lint && npm test
```

## 7. CI/CD

`.github/workflows/ci.yml` выполняет на каждый push/PR:

1. **Lint** — ESLint для каждого сервиса.
2. **Unit tests** — Jest для каждого сервиса.
3. **Docker build** — сборка образов всех трёх сервисов (multi-stage).
4. **Integration test** — поднимает полный стек через `docker compose`, дожидается healthcheck-ов, отправляет тестовый заказ через `curl` и проверяет ответ `201`.
