// Sunucuyu başlatır. Hangi klasörden çalıştırılırsa çalıştırılsın .env bu klasörden okunsun.
process.chdir(__dirname);
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Kiralık Truss http://localhost:${port} adresinde çalışıyor`));
