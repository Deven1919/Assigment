const express = require('express');
const app = express();
const morgan = require('morgan');
const userRouter = require('./Router/userRouter');
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(`${__dirname}/public`));
app.use('/api/v1/user', userRouter);

module.exports = app;
