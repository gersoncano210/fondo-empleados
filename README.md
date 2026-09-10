# Sistema para Fondo de Empleados

Sistema de gestión para un fondo de empleados colombiano: afiliación de asociados,
ahorros, créditos con aprobación escalonada y cartera con mora.

Contabilidad de doble partida. Dinero simulado, personas ficticias.

## Tecnologías

- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL 18 (en Docker)
- **ORM:** Prisma
- **Frontend:** Angular (workspace con dos aplicaciones)
- **Estilos:** Tailwind (portal), Angular Material (backoffice)

## Estructura

    backend/              API REST
    frontend/
      projects/
        portal/           Aplicación del asociado
        backoffice/       Aplicación de empleados
        shared/           Librería compartida
    docs/                 Modelo de datos, flujos y decisiones

## Puesta en marcha

Requisitos: Node.js 20+, Docker Desktop.

    # 1. Base de datos
    docker compose up -d

    # 2. Backend
    cd backend
    npm install
    cp .env.example .env
    npm run dev            # http://localhost:3000

    # 3. Frontend
    cd frontend
    npm install
    ng serve portal --port 4200
    ng serve backoffice --port 4300

## Estado

Fase 0 completada: entorno y estructura del proyecto