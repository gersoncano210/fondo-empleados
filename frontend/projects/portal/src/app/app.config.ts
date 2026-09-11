import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { credencialesInterceptor } from './nucleo/credenciales.interceptor';
import { refrescoInterceptor } from './nucleo/refresco.interceptor';
import { SesionServicio } from './nucleo/sesion.servicio';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([credencialesInterceptor, refrescoInterceptor]),
    ),
    // Carga la sesión antes de mostrar la aplicación
    provideAppInitializer(() => inject(SesionServicio).cargarSesion()),
  ],
};