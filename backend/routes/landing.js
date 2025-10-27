module.exports = (app) => {
  app.get('/', (_req, res) => {
    res.send('Sports Fans United API is running');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
};
