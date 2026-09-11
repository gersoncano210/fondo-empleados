import { Component, inject, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SesionServicio } from '../../nucleo/sesion.servicio';
import { AsociadoServicio } from '../../nucleo/asociado.servicio';
import { formatearPesos, nombreTipoCuenta } from 'shared';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-inicio',
  imports: [DatePipe],
  templateUrl: './inicio.html',
})
export class Inicio implements OnInit {
  private sesion = inject(SesionServicio);
  private asociados = inject(AsociadoServicio);
  private router = inject(Router);

  nombre = this.sesion.nombreCompleto;
  perfil = this.asociados.perfil;
  cargando = this.asociados.cargando;
  error = this.asociados.error;

  /** Suma de todos los saldos, para mostrar el total */
  totalAhorrado = computed(() => {
    const p = this.perfil();
    if (!p) return 0n;
    return p.saldos.reduce((suma, s) => suma + BigInt(s.saldo), 0n);
  });

  // Se exponen para poder usarlas en la plantilla
  formatear = formatearPesos;
  nombreTipo = nombreTipoCuenta;

  ngOnInit(): void {
    void this.asociados.cargarMiPerfil();
  }

  async salir(): Promise<void> {
    await this.sesion.cerrarSesion();
    await this.router.navigate(['/ingresar']);
  }
}