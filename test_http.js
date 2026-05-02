import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 5500,
  path: '/api/orders',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('Error:', data.substring(0, 200));
    } else {
      console.log('Success length:', data.length);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
