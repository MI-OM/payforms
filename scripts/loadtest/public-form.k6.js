import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const FORM_SLUG = __ENV.FORM_SLUG || 'demo-form';

export const options = {
  scenarios: {
    public_form_read_burst: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '3m', target: 600 },
        { duration: '3m', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/public/forms/${encodeURIComponent(FORM_SLUG)}`);

  check(response, {
    'status is 200': (res) => res.status === 200,
    'response has form id': (res) => {
      if (!res.body) {
        return false;
      }
      try {
        const body = JSON.parse(res.body);
        return !!body.id;
      } catch {
        return false;
      }
    },
  });

  sleep(0.3);
}
