/**
 * Sustituto de `server-only` para los tests.
 *
 * El paquete real lanza al importarse fuera del entorno de servidor de Next,
 * y Vitest no aplica la condición de exportación `react-server`. Anularlo
 * aquí no debilita nada: el guardián sigue activo en la compilación de la
 * aplicación, que es donde protege de verdad.
 */
export {};
