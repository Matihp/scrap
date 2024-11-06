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
      headless: "new"
    });
    this.page = await this.browser.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrapeProductsFromPage(url, gender, siteName, page = 1) {
    const siteSelectors = selectors[siteName];
    const products = [];
    let hasMoreProducts = true;

    try {
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      // Esperar a que los productos se carguen
      await this.page.waitForSelector(siteSelectors.price);

      while (hasMoreProducts) {
        const productElements = await this.page.$$(siteSelectors.imageLink);

        for (const element of productElements) {
          try {
            const title = await element.$eval(siteSelectors.title, el => el.textContent.trim());
            const price = await element.$eval(siteSelectors.price, el => {
              const priceText = el.textContent.replace(/[^\d,]/g, '').replace(',', '.');
              return parseFloat(priceText);
            });
            const imageUrl = await element.evaluate(el => el.href);

            products.push({
              title,
              price,
              imageUrl,
              gender,
              source: siteName,
              sourceUrl: url,
              updatedAt: new Date()
            });
          } catch (error) {
            console.error(`Error scraping product: ${error.message}`);
          }
        }

        // Verificar si hay más productos para cargar
        const loadMoreButton = await this.page.$(siteSelectors.loadMoreButton);
        if (loadMoreButton) {
          await loadMoreButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
        } else {
          hasMoreProducts = false;
        }
      }

      return products;
    } catch (error) {
      console.error(`Error scraping page ${url}: ${error.message}`);
      return [];
    }
  }

  async scrapeSite(siteName) {
    const site = selectors[siteName];
    let allProducts = [];

    try {
      await this.initialize();

      // Scrapear
      const menProducts = await this.scrapeProductsFromPage(
        site.baseUrls.men,
        'men',
        siteName
      );
      allProducts = [...allProducts, ...menProducts];

      const womenProducts = await this.scrapeProductsFromPage(
        site.baseUrls.women,
        'women',
        siteName
      );
      allProducts = [...allProducts, ...womenProducts];

      await Product.insertMany(allProducts); //guardar en mongo

    } catch (error) {
      console.error(`Error scraping site ${siteName}: ${error.message}`);
    } finally {
      await this.close();
    }

    return allProducts;
  }
}