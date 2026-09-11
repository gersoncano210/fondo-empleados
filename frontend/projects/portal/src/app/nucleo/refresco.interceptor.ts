import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Cuando una petición falla con 401, intenta renovar el token de acceso
 * y reintenta la petición original una sola vez.
 *
 * Esto es lo que hace que la sesión de 15 minutos sea invisible
 * para el usuario: el token se renueva solo.
 */
export const refrescoInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const http = inject(HttpClient);

  // No intentar refrescar sobre las propias rutas de sesión
  const esRutaDeSesion =
    peticion.url.includes('/auth/login') ||
    peticion.url.includes('/auth/refrescar') ||
    peticion.url.includes('/auth/logout');

  return siguiente(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || esRutaDeSesion) {
        return throwError(() => error);
      }

      return http
        .post(`${environment.apiUrl}/auth/refrescar`, {}, { withCredentials: true })
        .pipe(
          switchMap(() => siguiente(peticion.clone({ withCredentials: true }))),
          catchError(() => throwError(() => error)),
        );
    }),
  );
};