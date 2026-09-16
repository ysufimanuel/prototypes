require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dns = require('dns');

console.log('STEP A: express loaded');

const app = express();

console.log('STEP B: express app created');

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log('STEP C: cors loaded');

app.use(express.json());

console.log('STEP D: express.json loaded');

app.get('/api/health', (req, res) => {
  res.json({ success: true });
});

console.log('STEP E: route registered');

dns.lookup(
  'www.googleapis.com',
  { family: 4 },
  (error, address) => {
    console.log(
      'BEFORE LISTEN DNS:',
      error || address
    );

    app.listen(3002, () => {
      console.log(
        'TEST SERVER LISTENING: 3002'
      );

      dns.lookup(
        'www.googleapis.com',
        { family: 4 },
        (error2, address2) => {
          console.log(
            'AFTER LISTEN DNS:',
            error2 || address2
          );
        }
      );
    });
  }
);