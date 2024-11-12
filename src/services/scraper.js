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
      headless: "new",
      defaultViewport: null,
      args: ['--start-maximized']
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(60000);
    this.page.setDefaultNavigationTimeout(60000);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clickLoadMoreButton(siteSelectors) {
    try {
      const loadMoreButton = await this.page.$(siteSelectors.loadMoreButton);
      if (loadMoreButton) {
        await loadMoreButton.click();
        await this.wait(2000);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async scrollToBottom() {
    try {
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      
      // Esperar a que se carguen nuevos elementos
      await this.wait(2000);
      return true;
    } catch (error) {
      console.error('Error durante el scroll:', error);
      return false;
    }
  }

  async getAllProducts(siteSelectors) {
    const products = await this.page.evaluate((priceSelector, productLinkSelector, imageLinkSelector, titleSelector) => {
      const results = [];
      const container = document.querySelector('#gallery-layout-container');
      if (!container) return results;

      const productElements = container.children;
      
      for (let i = 0; i < productElements.length; i++) {
        try {
          const element = productElements[i];
          
          const priceEl = element.querySelector('span[class*="currencyInteger"]');
          const productLinkEl = element.querySelector('a');
          const imageLinkEl = element.querySelector('img');
          const titleEl = element.querySelector('h3');

          if (priceEl && productLinkEl && imageLinkEl && titleEl) {
            const priceText = priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.');
            results.push({
              title: titleEl.textContent.trim(),
              price: parseFloat(priceText),
              productLink: productLinkEl.href,
              imageUrl: imageLinkEl.src
            });
          }
        } catch (error) {
          console.error(`Error procesando producto ${i}:`, error);
        }
      }
      return results;
    }, siteSelectors.price, siteSelectors.productLink, siteSelectors.imageLink, siteSelectors.title);

    console.log(`Productos encontrados en esta iteración: ${products.length}`);
    if (products.length > 0) {
      console.log('Ejemplo de producto:');
    }

    return products;
  }

  async scrapeProductsFromPage(url, gender, siteName) {
    const siteSelectors = selectors[siteName];
    const products = new Set();
    let lastSize = 0;
    let sameCountRetries = 0;
    const maxRetries = 5; // Aumentado el número de reintentos

    try {
      console.log(`Iniciando scraping de ${gender} en ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      
      // Esperar a que la página cargue completamente
      await this.wait(5000);
      
      // Esperar al contenedor de productos
      await this.page.waitForSelector('#gallery-layout-container');

      while (true) {
        // Hacer scroll y esperar a que se carguen más productos
        await this.scrollToBottom();
        await this.wait(2000);

        // Intentar hacer click en "Mostrar más" si existe
        const clickedLoadMore = await this.clickLoadMoreButton(siteSelectors);
        if (clickedLoadMore) {
          await this.wait(2000);
        }

        // Obtener productos actuales
        const currentProducts = await this.getAllProducts(siteSelectors);
        
        // Agregar productos nuevos al Set
        currentProducts.forEach(product => {
          if (product.productLink) {
            products.add(JSON.stringify({
              ...product,
              gender,
              source: siteName,
              sourceUrl: url,
              updatedAt: new Date()
            }));
          }
        });

        console.log(`Total de productos encontrados: ${products.size}`);

        // Verificar si encontramos nuevos productos
        if (products.size === lastSize) {
          sameCountRetries++;
          console.log(`No se encontraron nuevos productos. Intento ${sameCountRetries}/${maxRetries}`);
          
          if (sameCountRetries >= maxRetries && !clickedLoadMore) {
            console.log('No hay más productos para cargar.');
            break;
          }
        } else {
          lastSize = products.size;
          sameCountRetries = 0;
        }

        await this.wait(1000);
      }

      const finalProducts = Array.from(products).map(p => JSON.parse(p));
      console.log(`Total de productos scrapeados para ${gender}: ${finalProducts.length}`);
      return finalProducts;

    } catch (error) {
      console.error(`Error scraping page ${url}: ${error.message}`);
      return Array.from(products).map(p => JSON.parse(p));
    }
  }

  async scrapeSite(siteName) {
    let allProducts = [];

    try {
      await this.initialize();

      console.log(`Iniciando scraping de ${siteName}...`);
      
      const menProducts = await this.scrapeProductsFromPage(
        selectors[siteName].baseUrls.men,
        'men',
        siteName
      );
      console.log(`Scrapeados ${menProducts.length} productos de hombre`);
      
      const womenProducts = await this.scrapeProductsFromPage(
        selectors[siteName].baseUrls.women,
        'women',
        siteName
      );
      console.log(`Scrapeados ${womenProducts.length} productos de mujer`);

      allProducts = [...menProducts, ...womenProducts];
      
      if (allProducts.length > 0) {
        console.log(`Guardando ${allProducts.length} productos en la base de datos...`);
        await Product.insertMany(allProducts);
      }

    } catch (error) {
      console.error(`Error scraping site ${siteName}: ${error.message}`);
    } finally {
      await this.close();
    }

    return allProducts;
  }
}

module.exports = ScraperService;