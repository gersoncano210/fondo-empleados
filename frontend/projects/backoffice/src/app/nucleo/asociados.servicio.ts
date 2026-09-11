import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { PerfilAsociado } from 'shared';

export interface ResumenAsociado {
  id: string;
  numeroAsociado: string;
  estado: string;
  fechaAfiliacion: string;
  persona: {
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
    telefono: string | null;
  };
  sucursal: { nombre: string };
}

export interface PaginaAsociados {
  total: number;
  pagina: number;
  paginas: number;
  asociados: ResumenAsociado[];
}

@Injectable({ providedIn: 'root' })
export class AsociadosServicio {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  async buscar(texto: string, pagina = 1): Promise<PaginaAsociados> {
    const params = new URLSearchParams({ busqueda: texto, pagina: String(pagina) });
    return firstValueFrom(
      this.http.get<PaginaAsociados>(`${this.api}/asociados?${params}`),
    );
  }

  async detalle(id: string): Promise<PerfilAsociado> {
    return firstValueFrom(this.http.get<PerfilAsociado>(`${this.api}/asociados/${id}`));
  }
}