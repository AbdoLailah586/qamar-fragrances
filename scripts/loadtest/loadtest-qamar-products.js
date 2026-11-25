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

const PRODUCT_URLS = [
  'https://qamar-fragrances.com/ar/product/all/Baccarat%20Rouge%20540%20Maison%20Francis%20Kurkdjian',
  'https://qamar-fragrances.com/ar/product/all/Guidance%20Amouage',
  'https://qamar-fragrances.com/ar/product/all/Interlude%20Man%20Amouage',
  'https://qamar-fragrances.com/ar/product/all/Jubilation%2040%20Amouage',
  'https://qamar-fragrances.com/ar/product/all/Outlands%20Amouage',
  'https://qamar-fragrances.com/ar/product/all/Purpose%20Amouage',
  'https://qamar-fragrances.com/ar/product/all/Hibiscus%20Mahagad%20Maison%20Crivelli',
  'https://qamar-fragrances.com/ar/product/all/Interlude%20Black%20Iris%20Amouage',
];

export default function () {
  const url = PRODUCT_URLS[Math.floor(Math.random() * PRODUCT_URLS.length)];
  const res = http.get(url, {
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
