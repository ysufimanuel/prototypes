require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dns = require('dns');

const adminUsersRouter = require('./admin-users');

console.log('STEP A: modules loaded');

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

console.log('STEP B: basic middleware ready');

app.use('/api/admin', adminUsersRouter);

console.log('STEP C: admin router mounted');

dns.lookup(
  'www.googleapis.com',
  { family: 4 },
  (error, address) => {
    console.log(
      'BEFORE LISTEN DNS:',
      error || address
    );

    app.listen(3003, () => {
      console.log(
        'TEST ROUTER SERVER LISTENING: 3003'
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