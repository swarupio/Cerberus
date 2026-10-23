
## 2026-10-23T12:33:03.000Z

60 seconds per mode; 20 requests/s total (10 per endpoint). Kill requested at 15 s; restart requested at 40 s. Percentages and nearest-rank latencies include all responses and network/time-out errors across both routes. Recovery is the first successful /users request dispatched after the restart request, measured from that request; Not observed means no recovery within the round. Background traffic is paused.

| Metric | Breaker ON | Breaker OFF |
| --- | ---: | ---: |
| Requests | 1200.00 | 1200.00 |
| Success | 72.33% | 80.50% |
| Errors | 27.67% | 19.50% |
| p50 latency | 6.00 ms | 7.00 ms |
| p95 latency | 17.23 ms | 3006.71 ms |
| /users recovery after restart request | 8.92 s | 2.08 s |

Action timing (seconds from round start):

```json
[
  {
    "mode": "on",
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.014527799999996,
        "completedSeconds": 16.0726409
      },
      {
        "command": "restart",
        "requestedSeconds": 40.000337300000005,
        "completedSeconds": 40.962768000000004
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 268,
        "errors": 332,
        "successPercent": 44.666666666666664,
        "errorPercent": 55.333333333333336,
        "p50Ms": 5.623099999997066,
        "p95Ms": 57.205000000001746,
        "recoverySeconds": 8.924524799999999
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 6.344200000006822,
        "p95Ms": 14.484000000004016,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "off",
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.012604700000011,
        "completedSeconds": 16.10245640000001
      },
      {
        "command": "restart",
        "requestedSeconds": 40.00065960000001,
        "completedSeconds": 40.95227430000002
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 366,
        "errors": 234,
        "successPercent": 61,
        "errorPercent": 39,
        "p50Ms": 9.450899999996182,
        "p95Ms": 3008.8706999999995,
        "recoverySeconds": 2.083542699999991
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 6.391900000002352,
        "p95Ms": 12.870300000009593,
        "recoverySeconds": null
      }
    }
  }
]
```
