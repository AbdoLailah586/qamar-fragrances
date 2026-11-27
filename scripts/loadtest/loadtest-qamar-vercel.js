import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 10 },
    { duration: '20s', target: 25 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '20s', target: 150 },
    { duration: '20s', target: 200 },
    { duration: '20s', target: 300 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '15s' },
    ],
    http_req_duration: [
      { threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '15s' },
    ],
  },
};

const TARGET_URL = 'https://qamar-fragrances.vercel.app/ar';

export default function () {
  const res = http.get(TARGET_URL, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    },
    timeout: '15s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response < 2s': (r) => r.timings.duration < 2000,
    'body not empty': (r) => r.body && r.body.length > 1000,
  });

  sleep(Math.random() + 0.5);
}
