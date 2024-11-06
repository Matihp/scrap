require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();

connectDB();

// Middleware
app.use(express.json());

// Rutas
app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor' 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});