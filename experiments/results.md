
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

## 2026-10-23T12:49:53.046Z

60 seconds per run; 20 requests/s total (10 per endpoint). Kill requested at 15 s; restart requested at 40 s. Percentages and nearest-rank latencies include all responses and network/time-out errors across both routes. Recovery is measured from the restart request to the first successful /users request dispatched afterward; Not observed means no recovery within the round. Background traffic is paused.

Breaker ON: three trials each at 30 s and 5 s cooldown, alternating 30/5. Averages are arithmetic means of the three per-run metrics, including mean per-run p95 (not pooled p95). Recovery mean is reported only if all runs recover.

| Cooldown (ON) | Runs | Mean success % | Mean run p95 (ms) | Mean recovery (s) |
| --- | ---: | ---: | ---: | ---: |
| 30 s | 3 | 72.33 | 16.11 | 8.91 |
| 5 s | 3 | 74.81 | 16.58 | 5.95 |

| Cooldown | Trial | Requests | Success % | p95 (ms) | Recovery (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 30 s | 1 | 1200 | 72.33 | 20.81 | 8.92 |
| 5 s | 1 | 1200 | 74.83 | 14.64 | 6.02 |
| 30 s | 2 | 1200 | 72.33 | 13.58 | 8.91 |
| 5 s | 2 | 1200 | 74.83 | 17.01 | 5.93 |
| 30 s | 3 | 1200 | 72.33 | 13.93 | 8.91 |
| 5 s | 3 | 1200 | 74.75 | 18.10 | 5.90 |

Per-run results and action timing (seconds from round start):

```json
[
  {
    "mode": "on",
    "resetTimeoutSeconds": 30,
    "trial": 1,
    "summary": {
      "requests": 1200,
      "successes": 868,
      "errors": 332,
      "successPercent": 72.33333333333334,
      "errorPercent": 27.666666666666668,
      "p50Ms": 5.697700000004261,
      "p95Ms": 20.81139999999141,
      "recoverySeconds": 8.920189499999994
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.0038905,
        "completedSeconds": 16.0777434
      },
      {
        "command": "restart",
        "requestedSeconds": 40.004235800000004,
        "completedSeconds": 41.0190445
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 268,
        "errors": 332,
        "successPercent": 44.666666666666664,
        "errorPercent": 55.333333333333336,
        "p50Ms": 5.1723000000056345,
        "p95Ms": 37.375,
        "recoverySeconds": 8.920189499999994
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 6.247899999987567,
        "p95Ms": 15.785399999993388,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "on",
    "resetTimeoutSeconds": 5,
    "trial": 1,
    "summary": {
      "requests": 1200,
      "successes": 898,
      "errors": 302,
      "successPercent": 74.83333333333333,
      "errorPercent": 25.166666666666664,
      "p50Ms": 5.561799999995856,
      "p95Ms": 14.638999999995576,
      "recoverySeconds": 6.017546399999992
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.005611700000008,
        "completedSeconds": 16.15701620000001
      },
      {
        "command": "restart",
        "requestedSeconds": 40.00285860000001,
        "completedSeconds": 40.97563039999999
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 298,
        "errors": 302,
        "successPercent": 49.666666666666664,
        "errorPercent": 50.33333333333333,
        "p50Ms": 5.505600000004051,
        "p95Ms": 3003.963300000003,
        "recoverySeconds": 6.017546399999992
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 5.639400000000023,
        "p95Ms": 11.37170000000333,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "on",
    "resetTimeoutSeconds": 30,
    "trial": 2,
    "summary": {
      "requests": 1200,
      "successes": 868,
      "errors": 332,
      "successPercent": 72.33333333333334,
      "errorPercent": 27.666666666666668,
      "p50Ms": 4.62489999999525,
      "p95Ms": 13.584000000002561,
      "recoverySeconds": 8.909828500000003
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.009784399999974,
        "completedSeconds": 16.019166
      },
      {
        "command": "restart",
        "requestedSeconds": 40.01003149999998,
        "completedSeconds": 40.97372509999998
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 268,
        "errors": 332,
        "successPercent": 44.666666666666664,
        "errorPercent": 55.333333333333336,
        "p50Ms": 4.467900000017835,
        "p95Ms": 3002.4375,
        "recoverySeconds": 8.909828500000003
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 4.753300000011222,
        "p95Ms": 11.31349999998929,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "on",
    "resetTimeoutSeconds": 5,
    "trial": 2,
    "summary": {
      "requests": 1200,
      "successes": 898,
      "errors": 302,
      "successPercent": 74.83333333333333,
      "errorPercent": 25.166666666666664,
      "p50Ms": 5.608800000016345,
      "p95Ms": 17.009799999999814,
      "recoverySeconds": 5.925003700000001
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.012380000000004,
        "completedSeconds": 16.065328700000013
      },
      {
        "command": "restart",
        "requestedSeconds": 40.00292540000001,
        "completedSeconds": 40.93094
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 298,
        "errors": 302,
        "successPercent": 49.666666666666664,
        "errorPercent": 50.33333333333333,
        "p50Ms": 5.212200000009034,
        "p95Ms": 3003.0928999999887,
        "recoverySeconds": 5.925003700000001
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 5.942800000018906,
        "p95Ms": 12.279599999979837,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "on",
    "resetTimeoutSeconds": 30,
    "trial": 3,
    "summary": {
      "requests": 1200,
      "successes": 868,
      "errors": 332,
      "successPercent": 72.33333333333334,
      "errorPercent": 27.666666666666668,
      "p50Ms": 5.24900000001071,
      "p95Ms": 13.932700000004843,
      "recoverySeconds": 8.906220100000034
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.013550400000007,
        "completedSeconds": 16.08932559999998
      },
      {
        "command": "restart",
        "requestedSeconds": 40.01395559999999,
        "completedSeconds": 40.956687799999955
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 268,
        "errors": 332,
        "successPercent": 44.666666666666664,
        "errorPercent": 55.333333333333336,
        "p50Ms": 4.894900000013877,
        "p95Ms": 3002.886700000032,
        "recoverySeconds": 8.906220100000034
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 5.448499999998603,
        "p95Ms": 11.034400000004098,
        "recoverySeconds": null
      }
    }
  },
  {
    "mode": "on",
    "resetTimeoutSeconds": 5,
    "trial": 3,
    "summary": {
      "requests": 1200,
      "successes": 897,
      "errors": 303,
      "successPercent": 74.75,
      "errorPercent": 25.25,
      "p50Ms": 5.628199999977369,
      "p95Ms": 18.096700000052806,
      "recoverySeconds": 5.89683779999998
    },
    "events": [
      {
        "command": "kill",
        "requestedSeconds": 15.000632700000017,
        "completedSeconds": 15.999048200000018
      },
      {
        "command": "restart",
        "requestedSeconds": 40.00962360000005,
        "completedSeconds": 40.985456400000025
      }
    ],
    "routes": {
      "/users": {
        "requests": 600,
        "successes": 297,
        "errors": 303,
        "successPercent": 49.5,
        "errorPercent": 50.5,
        "p50Ms": 5.6282000000355765,
        "p95Ms": 3002.3936000000103,
        "recoverySeconds": 5.89683779999998
      },
      "/orders": {
        "requests": 600,
        "successes": 600,
        "errors": 0,
        "successPercent": 100,
        "errorPercent": 0,
        "p50Ms": 5.601299999980256,
        "p95Ms": 12.89389999996638,
        "recoverySeconds": null
      }
    }
  }
]
```
