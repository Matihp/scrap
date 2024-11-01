const fs = require('fs');

function guardarDatos(nombreArchivo, datos) {
  const jsonData = JSON.stringify(datos);
  fs.writeFileSync(nombreArchivo, jsonData);
  console.log(`Datos guardados en ${nombreArchivo}`);
}

function leerDatos(nombreArchivo) {
  try {
    const jsonData = fs.readFileSync(nombreArchivo);
    return JSON.parse(jsonData);
  } catch (error) {
    console.error(`Error al leer ${nombreArchivo}:`, error);
    return []; // Devolvemos un array vacío si hay un error
  }
}

module.exports = { guardarDatos, leerDatos };