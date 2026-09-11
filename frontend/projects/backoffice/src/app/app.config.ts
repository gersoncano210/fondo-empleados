import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { credencialesInterceptor } from './nucleo/credenciales.interceptor';
import { refrescoInterceptor } from './nucleo/refresco.interceptor';
import { SesionServicio } from './nucleo/sesion.servicio';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([credencialesInterceptor, refrescoInterceptor]),
    ),
    provideAppInitializer(() => inject(SesionServicio).cargarSesion()),
  ],
};