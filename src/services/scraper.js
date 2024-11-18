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
      headless: true,
      defaultViewport: { width: 1300, height: 1080 },
      args: ['--window-size=1920,1080']
    });
    this.page = await this.browser.newPage();
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
    const scrollStep = 500;
    const scrollDelay = 500;

    for (let scrollPosition = 0; scrollPosition < scrollHeight; scrollPosition += scrollStep) {
      await this.page.evaluate((scrollPosition) => {
        window.scrollTo(0, scrollPosition);
      }, scrollPosition);
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }
  }

  async scrollToRightSlowly() {
    const scrollWidth = await this.page.evaluate(() => document.body.scrollWidth);
    const scrollStep = 500;
    const scrollDelay = 500;

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
          const linkElement = product.querySelector('a');
          if (!linkElement) return;

          const url = linkElement.href;
          if (seenUrls.has(url)) return;
          seenUrls.add(url);

          const integerPart1 = product.querySelector('span[class*="currencyContainer--summary"]')?.textContent.trim() || '';
          const fullPrice = `${integerPart1}`;

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

  async scrapeProductsFromPage(baseUrl, gender, siteName) {
    const products = new Map();
    let page = 1;
    let hasMoreProducts = true;

    try {
      while (hasMoreProducts) {
        const url = `${baseUrl}?page=${page}`;
        console.log(`Navegando a ${url}`);
        await this.page.goto(url, { waitUntil: 'networkidle0' });
        await this.page.waitForSelector('div[class^="vtex-search-result-3-x-galleryItem"]');

        // Scroll hasta el final de la página actual
        await this.scrollToBottomSlowly();
        await this.scrollToRightSlowly();

        // Obtener productos de la página actual
        const productElements = await this.getProductElements();
        console.log(`Encontrados ${productElements.length} productos en la página ${page}`);

        // Procesar productos
        productElements.forEach(elem => {
          if (!products.has(elem.link)) {
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

        // Verificar si hay más productos
        if (productElements.length === 0) {
          hasMoreProducts = false;
        } else {
          page++;
        }
      }

      const finalProducts = Array.from(products.values());
      console.log(`Scraping finalizado. Total de productos únicos: ${finalProducts.length}`);
      return finalProducts;

    } catch (error) {
      console.error(`Error scraping page ${baseUrl}:`, error);
      return Array.from(products.values());
    }
  }

  async scrapeSite(siteName) {
    const site = selectors[siteName];
    let allProducts = [];

    try {
      await this.initialize();

      console.log('Iniciando scraping de productos de hombres...');
      const menProducts = await this.scrapeProductsFromPage(
        site.baseUrls.men,
        'men',
        siteName
      );
      console.log(`Obtenidos ${menProducts.length} productos de hombres`);
      allProducts = [...allProducts, ...menProducts];

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