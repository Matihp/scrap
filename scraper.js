const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { guardarDatos } = require('./data'); // Importamos la función para guardar datos

const sitios = {
  'www.banA.com': {
    titulo: '.titulo-promocion-bancoA',
    fechaInicio: '.fecha-inicio-bancoA',
    fechaExpiracion: '.fecha-expiracion-bancoA'
  },
  'www.banB.com': {
    titulo: '#promocion-titulo',
    fechaInicio: 'div.fecha span',
    fechaExpiracion: 'div.fecha span:nth-child(2)'
  }
  // ... agregar más sitios web aquí
};

async function scrapeData(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const html = await page.content();
  const $ = cheerio.load(html);

  const config = sitios[url]; 

  try {
    const titulo = $(config.titulo).text();
    const fechaInicio = $(config.fechaInicio).text();
    const fechaExpiracion = $(config.fechaExpiracion).text();

    await browser.close();

    return { titulo, fechaInicio, fechaExpiracion, url }; // Incluimos la URL
  } catch (error) {
    console.error(`Error al scrapear ${url}:`, error);
    await browser.close();
    return null; // Devolvemos null si hay un error
  }
}

async function scrapearSitios() {
  const promociones = [];

  for (const url in sitios) {
    const data = await scrapeData(url);
    if (data) {
      promociones.push(data);
    }
  }

  guardarDatos('promociones.json', promociones);
}

// Programamos el scraping para que se ejecute todos los días a las 8:00 AM
cron.schedule('0 8 * * *', () => {
  console.log('Iniciando scraping...');
  scrapearSitios();
});

// Para probar el scraper manualmente:
// scrapearSitios();