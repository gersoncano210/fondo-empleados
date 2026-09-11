import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { SesionServicio } from '../../nucleo/sesion.servicio';
import { CajaServicio, type EstadoHorario } from '../../nucleo/caja.servicio';
import { AsociadosServicio, type ResumenAsociado } from '../../nucleo/asociados.servicio';
import { formatearPesos, nombreTipoCuenta, type PerfilAsociado } from 'shared';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-ventanilla',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatIconModule,
    DatePipe,
  ],
  templateUrl: './ventanilla.html',
})
export class Ventanilla implements OnInit {
  private fb = inject(FormBuilder);
  private sesion = inject(SesionServicio);
  private cajaServicio = inject(CajaServicio);
  private asociados = inject(AsociadosServicio);
  private aviso = inject(MatSnackBar);
  private router = inject(Router);

  nombre = this.sesion.nombreCompleto;
  caja = this.cajaServicio.caja;

  horario = signal<EstadoHorario | null>(null);
  resultados = signal<ResumenAsociado[]>([]);
  seleccionado = signal<PerfilAsociado | null>(null);
  procesando = signal(false);

  hayCaja = computed(() => this.caja() !== null);

  formBusqueda = this.fb.nonNullable.group({
    texto: ['', [Validators.required, Validators.minLength(3)]],
  });

  formApertura = this.fb.nonNullable.group({
    saldoInicial: [0, [Validators.min(0)]],
  });

  formOperacion = this.fb.nonNullable.group({
    cuentaId: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
  });

  formCierre = this.fb.nonNullable.group({
    saldoContado: [0, [Validators.required, Validators.min(0)]],
  });

  formatear = formatearPesos;
  nombreTipo = nombreTipoCuenta;

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cajaServicio.cargarMiCaja(),
      this.cargarHorario(),
    ]);
  }

  private async cargarHorario(): Promise<void> {
    this.horario.set(await this.cajaServicio.horario());
  }

  async abrirCaja(): Promise<void> {
    this.procesando.set(true);
    try {
      await this.cajaServicio.abrir(this.formApertura.getRawValue().saldoInicial);
      this.notificar('Caja abierta');
    } catch (e) {
      this.notificarError(e);
    } finally {
      this.procesando.set(false);
    }
  }

  async cerrarCaja(): Promise<void> {
    const cajaActual = this.caja();
    if (!cajaActual) return;

    this.procesando.set(true);
    try {
      const resultado: any = await this.cajaServicio.cerrar(
        cajaActual.id,
        this.formCierre.getRawValue().saldoContado,
      );

      const mensaje =
        resultado.estado === 'CUADRADA'
          ? 'Caja cerrada. Arqueo cuadrado.'
          : `Caja cerrada con diferencia de ${formatearPesos(resultado.diferencia)}`;

      this.notificar(mensaje);
      this.seleccionado.set(null);
    } catch (e) {
      this.notificarError(e);
    } finally {
      this.procesando.set(false);
    }
  }

  async buscar(): Promise<void> {
    if (this.formBusqueda.invalid) return;

    try {
      const pagina = await this.asociados.buscar(
        this.formBusqueda.getRawValue().texto,
      );
      this.resultados.set(pagina.asociados);

      if (pagina.asociados.length === 0) {
        this.notificar('Sin resultados');
      }
    } catch (e) {
      this.notificarError(e);
    }
  }

  async seleccionar(asociado: ResumenAsociado): Promise<void> {
    try {
      const perfil = await this.asociados.detalle(asociado.id);
      this.seleccionado.set(perfil);
      this.resultados.set([]);
      this.formBusqueda.reset();

      const ahorro = perfil.saldos.find((s) => s.tipo === 'AHORRO_VOLUNTARIO');
      if (ahorro) {
        this.formOperacion.patchValue({ cuentaId: ahorro.cuentaId });
      }
    } catch (e) {
      this.notificarError(e);
    }
  }

  async depositar(): Promise<void> {
    await this.operar('depositar');
  }

  async retirar(): Promise<void> {
    await this.operar('retirar');
  }

  private async operar(accion: 'depositar' | 'retirar'): Promise<void> {
    if (this.formOperacion.invalid) {
      this.formOperacion.markAllAsTouched();
      return;
    }

    const { cuentaId, monto } = this.formOperacion.getRawValue();
    this.procesando.set(true);

    try {
      const resultado =
        accion === 'depositar'
          ? await this.cajaServicio.depositar(cuentaId, monto)
          : await this.cajaServicio.retirar(cuentaId, monto);

      this.notificar(
        `${accion === 'depositar' ? 'Depósito' : 'Retiro'} exitoso. Saldo: ${formatearPesos(resultado.saldoNuevo)}`,
      );

      // Refresca el perfil para ver el saldo actualizado
      const actual = this.seleccionado();
      if (actual) {
        this.seleccionado.set(await this.asociados.detalle(actual.id));
      }
      this.formOperacion.patchValue({ monto: 0 });
    } catch (e) {
      this.notificarError(e);
    } finally {
      this.procesando.set(false);
    }
  }

  limpiar(): void {
    this.seleccionado.set(null);
    this.formOperacion.reset();
  }

  async salir(): Promise<void> {
    await this.sesion.cerrarSesion();
    await this.router.navigate(['/ingresar']);
  }

  private notificar(mensaje: string): void {
    this.aviso.open(mensaje, 'Cerrar', { duration: 4000 });
  }

  private notificarError(e: any): void {
    this.aviso.open(
      e?.error?.mensaje ?? 'Ocurrió un error',
      'Cerrar',
      { duration: 6000, panelClass: 'error-snack' },
    );
  }
}