import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Usuario, Credenciales } from 'shared';

@Injectable({ providedIn: 'root' })
export class SesionServicio {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** Usuario actual. null si no hay sesión. */
  private _usuario = signal<Usuario | null>(null);
  private _cargando = signal(true);

  /** Señales de solo lectura para los componentes */
  usuario = this._usuario.asReadonly();
  cargando = this._cargando.asReadonly();

  autenticado = computed(() => this._usuario() !== null);
  nombreCompleto = computed(() => {
    const u = this._usuario();
    return u ? `${u.nombres} ${u.apellidos}` : '';
  });

  async iniciarSesion(credenciales: Credenciales): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<{ usuario: Usuario }>(
        `${this.api}/auth/login`,
        credenciales,
        { withCredentials: true },
      ),
    );
    this._usuario.set(respuesta.usuario);
  }

  async cerrarSesion(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.api}/auth/logout`, {}, { withCredentials: true }),
      );
    } finally {
      this._usuario.set(null);
    }
  }

  /**
   * Pregunta al backend quién está autenticado.
   * Se llama al arrancar la aplicación: como el token vive en una cookie
   * httpOnly, el frontend no puede leerlo y tiene que preguntar.
   */
  async cargarSesion(): Promise<void> {
    this._cargando.set(true);
    try {
      const usuario = await firstValueFrom(
        this.http.get<Usuario>(`${this.api}/auth/yo`, { withCredentials: true }),
      );
      this._usuario.set(usuario);
    } catch {
      this._usuario.set(null);
    } finally {
      this._cargando.set(false);
    }
  }

  tienePermiso(clave: string): boolean {
    return this._usuario()?.permisos.includes(clave) ?? false;
  }
}