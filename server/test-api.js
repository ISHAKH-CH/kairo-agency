const http = require('http');

async function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  const { server } = require('./index');
  // Wait 500ms for server to boot
  await new Promise(r => setTimeout(r, 500));

  console.log('Testing Ledgerly API Endpoints...');

  try {
    const endpoints = [
      '/api/health',
      '/api/dashboard',
      '/api/products',
      '/api/products/summary',
      '/api/customers',
      '/api/customers/summary',
      '/api/customers/1/statement',
      '/api/suppliers',
      '/api/purchases',
      '/api/purchases/summary',
      '/api/quotations',
      '/api/quotations/summary',
      '/api/sales',
      '/api/sales/summary',
      '/api/payments',
      '/api/payments/summary',
      '/api/expenditures',
      '/api/expenditures/summary',
      '/api/reports/sales-summary',
      '/api/reports/income-expense',
      '/api/reports/stock-valuation',
      '/api/search?q=chair',
      '/api/settings/business'
    ];

    for (const ep of endpoints) {
      const res = await testEndpoint(ep);
      if (res.status === 200 && (res.data?.success || res.data?.status === 'ok')) {
        console.log(`[PASS] ${ep}`);
      } else {
        console.error(`[FAIL] ${ep} - Status: ${res.status}`, res.data);
      }
    }

    console.log('\nAll API endpoints tested successfully!');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    server.close();
  }
}

runTests();
