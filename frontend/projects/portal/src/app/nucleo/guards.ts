import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SesionServicio } from './sesion.servicio';

/**
 * Protege rutas que exigen sesión iniciada.
 * Equivale al RutaProtegida que escribiste a mano en Cinea,
 * pero es un concepto nativo del router.
 */
export const guardAutenticado: CanActivateFn = async (_ruta, estado) => {
  const sesion = inject(SesionServicio);
  const router = inject(Router);

  if (!sesion.usuario()) {
    await sesion.cargarSesion();
  }

  if (sesion.autenticado()) {
    return true;
  }

  return router.createUrlTree(['/ingresar'], {
    queryParams: { regresarA: estado.url },
  });
};

/** Impide entrar al login si ya hay sesión */
export const guardInvitado: CanActivateFn = async () => {
  const sesion = inject(SesionServicio);
  const router = inject(Router);

  if (!sesion.usuario()) {
    await sesion.cargarSesion();
  }

  if (sesion.autenticado()) {
    return router.createUrlTree(['/inicio']);
  }

  return true;
};