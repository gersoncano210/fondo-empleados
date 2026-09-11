import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SesionServicio } from '../../nucleo/sesion.servicio';

@Component({
  selector: 'app-ingresar',
  imports: [ReactiveFormsModule],
  templateUrl: './ingresar.html',
})
export class Ingresar {
  private fb = inject(FormBuilder);
  private sesion = inject(SesionServicio);
  private router = inject(Router);
  private ruta = inject(ActivatedRoute);

  enviando = signal(false);
  error = signal<string | null>(null);

  formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
  });

  get correo() {
    return this.formulario.controls.correo;
  }

  get contrasena() {
    return this.formulario.controls.contrasena;
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    try {
      await this.sesion.iniciarSesion(this.formulario.getRawValue());

      const destino =
        this.ruta.snapshot.queryParamMap.get('regresarA') ?? '/inicio';
      await this.router.navigateByUrl(destino);
    } catch (e: any) {
      this.error.set(
        e?.error?.mensaje ?? 'No fue posible iniciar sesión. Intente de nuevo.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}