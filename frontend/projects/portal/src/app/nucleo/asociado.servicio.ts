import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { PerfilAsociado } from 'shared';

@Injectable({ providedIn: 'root' })
export class AsociadoServicio {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  private _perfil = signal<PerfilAsociado | null>(null);
  private _cargando = signal(false);
  private _error = signal<string | null>(null);

  perfil = this._perfil.asReadonly();
  cargando = this._cargando.asReadonly();
  error = this._error.asReadonly();

  async cargarMiPerfil(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);

    try {
      const perfil = await firstValueFrom(
        this.http.get<PerfilAsociado>(`${this.api}/asociados/mi-perfil`),
      );
      this._perfil.set(perfil);
    } catch (e: any) {
      this._error.set(
        e?.error?.mensaje ?? 'No fue posible cargar su información.',
      );
      this._perfil.set(null);
    } finally {
      this._cargando.set(false);
    }
  }
}