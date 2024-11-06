const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }
    
    console.log('Intentando conectar a MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Atlas conectado exitosamente');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;