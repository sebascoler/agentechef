/**
 * Helpers de fechas con soporte para zona horaria Europe/Madrid.
 */

const ZONA_MADRID = 'Europe/Madrid';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const NOMBRES_DIAS = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

function ahora() {
  return new Date();
}

function ahoraEnMadrid() {
  const fecha = new Date();
  const opciones = { timeZone: ZONA_MADRID };
  return new Date(fecha.toLocaleString('en-US', opciones));
}

function diaSemanaEnMadrid() {
  const fecha = ahoraEnMadrid();
  const indice = fecha.getDay(); // 0 = domingo
  return DIAS_SEMANA[indice];
}

/**
 * Devuelve la semana ISO en formato YYYY-WNN para una fecha dada.
 * La semana ISO comienza en lunes.
 */
function semanaISO(fecha) {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7; // lunes=1, domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const primerDia = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - primerDia) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

function semanaISOActual() {
  return semanaISO(ahoraEnMadrid());
}

/**
 * Dado un string "YYYY-WNN", devuelve el lunes de esa semana como Date.
 */
function lunesDeSemana(semanaIsoStr) {
  const [anio, semana] = semanaIsoStr.split('-W').map(Number);
  const primerDia = new Date(Date.UTC(anio, 0, 1));
  const diasOffset = (1 - (primerDia.getUTCDay() || 7)) + (semana - 1) * 7;
  return new Date(Date.UTC(anio, 0, 1 + diasOffset));
}

/**
 * Dado el lunes de una semana, devuelve el domingo (+6 días).
 */
function domingoDeSemana(lunesDate) {
  const domingo = new Date(lunesDate);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  return domingo;
}

function formatearFecha(fecha) {
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_MADRID,
  });
}

function formatearFechaSemana(semanaIsoStr) {
  const lunes = lunesDeSemana(semanaIsoStr);
  const domingo = domingoDeSemana(lunes);
  return `${formatearFecha(lunes)} al ${formatearFecha(domingo)}`;
}

function nombreDia(dia) {
  return NOMBRES_DIAS[dia] || dia;
}

function fechaDeHoyFormateada() {
  return ahoraEnMadrid().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ZONA_MADRID,
  });
}

module.exports = {
  diaSemanaEnMadrid,
  semanaISOActual,
  semanaISO,
  lunesDeSemana,
  formatearFecha,
  formatearFechaSemana,
  nombreDia,
  fechaDeHoyFormateada,
  DIAS_SEMANA,
};
