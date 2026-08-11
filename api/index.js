const { app, server } = require('../server');

// Para uso na Vercel como serverless function
module.exports = (req, res) => {
  return new Promise((resolve, reject) => {
    res.json = (statusCodeOrData, data) => {
      let status = 200;
      let payload = statusCodeOrData;
      if (typeof statusCodeOrData === 'number') {
        status = statusCodeOrData;
        payload = data;
      }
      res.status(status).json(payload);
    };

    // Emitir a requisição para o handler interno do server.js
    server.emit('request', req, res);
    res.on('finish', resolve);
    res.on('error', reject);
  });
};
