import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CajaAbierta {
  id: string;
  sucursalId: string;
  fechaApertura: string;
  saldoInicial: string;
  estado: string;
  sucursal?: { nombre: string };
}

export interface ResultadoOperacion {
  transaccionId: string;
  cuentaId: string;
  monto: string;
  saldoNuevo: string;
}

export interface EstadoHorario {
  abierta: boolean;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class CajaServicio {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  private _caja = signal<CajaAbierta | null>(null);
  caja = this._caja.asReadonly();

  async cargarMiCaja(): Promise<void> {
    const caja = await firstValueFrom(
      this.http.get<CajaAbierta | null>(`${this.api}/caja/mi-caja`),
    );
    this._caja.set(caja);
  }

  async abrir(saldoInicial: number): Promise<void> {
    const caja = await firstValueFrom(
      this.http.post<CajaAbierta>(`${this.api}/caja/abrir`, { saldoInicial }),
    );
    this._caja.set(caja);
  }

  async cerrar(cajaId: string, saldoContado: number): Promise<any> {
    const caja = await firstValueFrom(
      this.http.post(`${this.api}/caja/${cajaId}/cerrar`, { saldoContado }),
    );
    this._caja.set(null);
    return caja;
  }

  async depositar(cuentaId: string, monto: number): Promise<ResultadoOperacion> {
    return firstValueFrom(
      this.http.post<ResultadoOperacion>(`${this.api}/caja/depositar`, {
        cuentaId,
        monto,
      }),
    );
  }

  async retirar(
    cuentaId: string,
    monto: number,
    autorizadoPorId?: string,
  ): Promise<ResultadoOperacion> {
    return firstValueFrom(
      this.http.post<ResultadoOperacion>(`${this.api}/caja/retirar`, {
        cuentaId,
        monto,
        autorizadoPorId,
      }),
    );
  }

  async horario(): Promise<EstadoHorario> {
    return firstValueFrom(this.http.get<EstadoHorario>(`${this.api}/caja/horario`));
  }

  async movimientos(cajaId: string): Promise<any[]> {
    return firstValueFrom(this.http.get<any[]>(`${this.api}/caja/${cajaId}/movimientos`));
  }
}