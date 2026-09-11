import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Agrega withCredentials a todas las peticiones para que el navegador
 * envíe las cookies de sesión. Evita repetirlo en cada llamada.
 */
export const credencialesInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  return siguiente(peticion.clone({ withCredentials: true }));
};