const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: String,
  price: Number,
  imageUrl: String,
  gender: {
    type: String,
    enum: ['men', 'women']
  },
  source: String,
  sourceUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

module.exports = mongoose.model('Product', productSchema);