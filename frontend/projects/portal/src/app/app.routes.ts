import type { Routes } from '@angular/router';
import { guardAutenticado, guardInvitado } from './nucleo/guards';

export const routes: Routes = [
  {
    path: 'ingresar',
    canActivate: [guardInvitado],
    loadComponent: () =>
      import('./paginas/ingresar/ingresar').then((m) => m.Ingresar),
  },
  {
    path: 'inicio',
    canActivate: [guardAutenticado],
    loadComponent: () =>
      import('./paginas/inicio/inicio').then((m) => m.Inicio),
  },
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: '**', redirectTo: 'inicio' },
];