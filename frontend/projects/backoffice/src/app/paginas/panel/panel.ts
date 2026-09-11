import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SesionServicio } from '../../nucleo/sesion.servicio';

@Component({
  selector: 'app-panel',
  imports: [RouterLink],
  templateUrl: './panel.html',
})
export class Panel {
  private sesion = inject(SesionServicio);
  usuario = this.sesion.usuario;
  nombre = this.sesion.nombreCompleto;
}