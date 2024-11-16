const puppeteer = require('puppeteer');
const Product = require('../models/Product');
const selectors = require('../config/selectors.json');

class ScraperService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false, // Desactivar el modo headless
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--window-size=1920,1080']
    });
    this.page = await this.browser.newPage();
    // Aumentar los timeouts
    await this.page.setDefaultNavigationTimeout(60000);
    await this.page.setDefaultTimeout(30000);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrollToBottomSlowly() {
    const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
    const scrollStep = 500; // Paso de scroll
    const scrollDelay = 500; // Retraso entre pasos de scroll en milisegundos

    for (let scrollPosition = 0; scrollPosition < scrollHeight; scrollPosition += scrollStep) {
      await this.page.evaluate((scrollPosition) => {
        window.scrollTo(0, scrollPosition);
      }, scrollPosition);
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }
  }

  async scrollToRightSlowly() {
    const scrollWidth = await this.page.evaluate(() => document.body.scrollWidth);
    const scrollStep = 500; // Paso de scroll
    const scrollDelay = 500; // Retraso entre pasos de scroll en milisegundos

    for (let scrollPosition = 0; scrollPosition < scrollWidth; scrollPosition += scrollStep) {
      await this.page.evaluate((scrollPosition) => {
        window.scrollTo(scrollPosition, 0);
      }, scrollPosition);
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }
  }

  async getProductElements() {
    return await this.page.evaluate(() => {
      const products = Array.from(document.querySelectorAll('div[class^="vtex-search-result-3-x-galleryItem"]'));
      const seenUrls = new Set();
      const uniqueProducts = [];

      products.forEach((product) => {
        try {
          const linkElement = product.document.querySelector('div[class^="vtex-product-summary-2-x-clearLink--product-card"]');
          if (!linkElement) return;

          const url = linkElement.href;
          console.log(url);
          if (seenUrls.has(url)) return;
          seenUrls.add(url);

          // Obtener todos los componentes del precio
          const integerPart1 = product.querySelector('span[class*="currencyInteger--summary"]')?.textContent.trim() || '';
          const decimalPart = product.querySelector('span[class*="currencyGroup--summary"]')?.textContent.trim() || '';
          const integerPart2 = product.querySelector('span[class*="currencyInteger--summary"]:nth-of-type(2)')?.textContent.trim() || '';

          // Construir el precio completo
          const fullPrice = `${integerPart1}${decimalPart}${integerPart2}`;

          const imageElement = product.querySelector('img');
          const titleElement = product.querySelector('h3');

          if (fullPrice && imageElement && titleElement) {
            uniqueProducts.push({
              price: fullPrice,
              link: url,
              image: imageElement.src,
              title: titleElement.textContent.trim()
            });
          }
        } catch (error) {
          console.error('Error processing product:', error);
        }
      });

      return uniqueProducts;
    });
  }

  async scrapeProductsFromPage(url, gender, siteName) {
    const products = new Map();
    let lastHeight = 0;
    let sameHeightCount = 0;
    const MAX_SAME_HEIGHT = 1;

    try {
      console.log(`Navegando a ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      await this.page.waitForSelector('div[class^="vtex-search-result-3-x-galleryItem"]');

      while (sameHeightCount < MAX_SAME_HEIGHT) {
        // Obtener la altura actual
        const currentHeight = await this.page.evaluate(() => document.documentElement.scrollHeight);

        const productElements = await this.getProductElements();
        console.log(`Encontrados ${productElements.length} productos en la página`);

        // Procesar productos
        productElements.forEach(elem => {
          if (!products.has(elem.link)) {
            // Convertir precio a número
            const priceStr = elem.price.replace(/[^\d,]/g, '').replace(',', '.');
            const price = parseFloat(priceStr);

            products.set(elem.link, {
              title: elem.title,
              price: price,
              productLink: elem.link,
              imageUrl: elem.image,
              gender,
              source: siteName,
              sourceUrl: url,
              updatedAt: new Date()
            });
          }
        });

        console.log(`Total de productos únicos acumulados: ${products.size}`);

        // Scroll vertical y horizontal lentamente
        await this.scrollToBottomSlowly();
        await this.scrollToRightSlowly();
        const newHeight = await this.page.evaluate(() => document.documentElement.scrollHeight);

        if (newHeight === lastHeight) {
          sameHeightCount++;
          console.log(`Altura de página sin cambios. Intento ${sameHeightCount} de ${MAX_SAME_HEIGHT}`);
        } else {
          sameHeightCount = 0;
          lastHeight = newHeight;
        }

        // Esperar un poco más después del scroll
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const finalProducts = Array.from(products.values());
      console.log(`Scraping finalizado. Total de productos únicos: ${finalProducts.length}`);
      return finalProducts;

    } catch (error) {
      console.error(`Error scraping page ${url}:`, error);
      return Array.from(products.values());
    }
  }

  async scrapeSite(siteName) {
    const site = selectors[siteName];
    let allProducts = [];

    try {
      await this.initialize();

      // Scrapear productos de hombres
      console.log('Iniciando scraping de productos de hombres...');
      const menProducts = await this.scrapeProductsFromPage(
        site.baseUrls.men,
        'men',
        siteName
      );
      console.log(`Obtenidos ${menProducts.length} productos de hombres`);
      allProducts = [...allProducts, ...menProducts];

      // Scrapear productos de mujeres
      console.log('Iniciando scraping de productos de mujeres...');
      const womenProducts = await this.scrapeProductsFromPage(
        site.baseUrls.women,
        'women',
        siteName
      );
      console.log(`Obtenidos ${womenProducts.length} productos de mujeres`);
      allProducts = [...allProducts, ...womenProducts];

      if (allProducts.length > 0) {
        console.log(`Guardando ${allProducts.length} productos en la base de datos...`);
        await Product.insertMany(allProducts);
      }

    } catch (error) {
      console.error(`Error scraping site ${siteName}:`, error);
    } finally {
      await this.close();
    }

    return allProducts;
  }
}

module.exports = ScraperService;




