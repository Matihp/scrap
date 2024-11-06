const express = require('express');
const router = express.Router();
const ScraperService = require('../services/scraper');
const Product = require('../models/Product');

router.post('/scrape', async (req, res) => {
  try {
    const scraper = new ScraperService();
    const products = await scraper.scrapeSite('sporting.com.ar');
    res.json({ 
      success: true, 
      productsScraped: products.length,
      message: 'Scraping completado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { gender, source } = req.query;
    const query = {};
    
    if (gender) query.gender = gender;
    if (source) query.source = source;
    
    const products = await Product.find(query).sort('-createdAt');
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;