import type { Routes } from '@angular/router';
import { guardAutenticado, guardInvitado } from './nucleo/guards';

export const routes: Routes = [
  {
    path: 'ingresar',
    canActivate: [guardInvitado],
    loadComponent: () => import('./paginas/ingresar/ingresar').then((m) => m.Ingresar),
  },
  {
    path: 'panel',
    canActivate: [guardAutenticado],
    loadComponent: () => import('./paginas/panel/panel').then((m) => m.Panel),
  },
  {
    path: 'ventanilla',
    canActivate: [guardAutenticado],
    loadComponent: () =>
      import('./paginas/ventanilla/ventanilla').then((m) => m.Ventanilla),
  },
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
  { path: '**', redirectTo: 'panel' },
];