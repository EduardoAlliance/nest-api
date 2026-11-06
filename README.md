# NestJS API Skeleton

API REST profesional con autenticación OAuth2/PKCE, RBAC, y arquitectura limpia lista para producción.

## Stack Tecnológico

- **Runtime:** Node.js 20+
- **Framework:** NestJS 11 (TypeScript)
- **ORM:** TypeORM con MySQL 8
- **Autenticación:** OAuth2 con PKCE, JWT (access + refresh token rotativo)
- **Cache:** Redis
- **Logging:** Winston (consola + archivos rotativos)
- **Documentación:** Swagger/OpenAPI
- **Email:** Mailpit (desarrollo)
- **Contenedores:** Docker + Docker Compose

## Estructura del Proyecto

```
src/
├── config/              # Configuración de módulos (app, db, jwt, redis, etc.)
├── database/
│   ├── seeds/           # Seeders (usuario admin por defecto)
│   └── typeorm.config.ts
├── logging/             # Módulo de logging con Winston
├── modules/
│   ├── auth/            # Autenticación (login, registro, OAuth2 PKCE, refresh, reset password)
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/  # JWT Strategy, Refresh Strategy
│   ├── common/          # Decoradores, Filtros, Interceptores, Guards globales
│   │   ├── decorators/  # @Roles, @CurrentUser, @Public
│   │   ├── filters/     # AllExceptionsFilter
│   │   ├── guards/      # RolesGuard
│   │   └── interceptors/ # ResponseInterceptor
│   └── users/           # CRUD de usuarios (solo admin)
│       ├── dto/
│       └── entities/
├── app.module.ts
└── main.ts
```

## Requisitos Previos

- Node.js 20+
- pnpm
- Docker y Docker Compose (opcional, para entorno completo)
- MySQL 8 (si no usas Docker)

## Instalación y Ejecución

### 1. Usando Docker (Recomendado)

```bash
# Clonar el repositorio
git clone <repo-url> nest-api
cd nest-api

# Copiar variables de entorno
cp .env.example .env

# Iniciar todos los servicios
docker compose up -d

# Ejecutar migraciones (se ejecutan automáticamente con synchronize: true en desarrollo)
# Ejecutar seeder para crear usuario admin
docker compose exec app pnpm run seed
```

### 2. Sin Docker (Desarrollo Local)

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MySQL y Redis

# Iniciar en modo desarrollo
pnpm run start:dev
```

### Comandos Disponibles

```bash
# Desarrollo
pnpm run start:dev         # Iniciar con hot-reload
pnpm run start:debug       # Iniciar en modo debug
pnpm run build             # Compilar a JavaScript

# Base de datos
pnpm run seed              # Ejecutar seeder (crea usuario admin)
pnpm run migration:generate  # Generar migración
pnpm run migration:run       # Ejecutar migraciones
pnpm run migration:revert    # Revertir última migración

# Calidad
pnpm run lint              # Verificar linting
```

## Usuario Admin por Defecto

Después de ejecutar el seeder:

- **Email:** admin@example.com
- **Password:** Admin123!

## Endpoints de la API

### Autenticación (`/api/v1/auth`)

| Método | Endpoint               | Auth     | Descripción                          |
|--------|------------------------|----------|--------------------------------------|
| POST   | `/auth/register`       | Público  | Registrar nuevo usuario              |
| POST   | `/auth/login`          | Público  | Iniciar sesión                       |
| POST   | `/auth/refresh`        | Refresh  | Renovar access token                 |
| POST   | `/auth/logout`         | JWT      | Cerrar sesión                        |
| POST   | `/auth/forgot-password`| Público  | Solicitar reseteo de contraseña      |
| POST   | `/auth/reset-password` | Público  | Resetear contraseña con token        |
| POST   | `/auth/verify-email`   | Público  | Verificar email con token            |

### OAuth2 PKCE (`/api/v1/oauth`)

| Método | Endpoint          | Auth    | Descripción                                    |
|--------|-------------------|---------|------------------------------------------------|
| POST   | `/oauth/authorize`| Público | Generar código de autorización (inicia flujo)  |
| POST   | `/oauth/token`    | Público | Intercambiar código por tokens                 |

### Usuarios (`/api/v1/users`)

| Método | Endpoint             | Auth | Rol    | Descripción                     |
|--------|----------------------|------|--------|---------------------------------|
| POST   | `/users`             | JWT  | admin  | Crear usuario                   |
| GET    | `/users`             | JWT  | admin  | Listar usuarios (paginado)      |
| GET    | `/users/profile`     | JWT  | *      | Obtener perfil propio           |
| GET    | `/users/:id`         | JWT  | admin  | Obtener usuario por ID          |
| PATCH  | `/users/:id`         | JWT  | admin  | Actualizar usuario              |
| DELETE | `/users/:id`         | JWT  | admin  | Eliminar usuario (soft delete)  |
| POST   | `/users/:id/restore` | JWT  | admin  | Restaurar usuario eliminado     |

## Documentación Swagger

Disponible en: `http://localhost:3000/api/docs`

## Flujo OAuth2 con PKCE (para SPA)

### 1. El cliente (SPA) genera el code_verifier y code_challenge

```javascript
// Ejemplo en el frontend (React)
function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  return { codeVerifier, codeChallenge };
}
```

### 2. Solicitar código de autorización

```
POST /api/v1/oauth/authorize
Body: {
  "clientId": "spa-client",
  "redirectUri": "http://localhost:3001/callback",
  "responseType": "code",
  "codeChallenge": "<base64url(sha256(codeVerifier))>",
  "codeChallengeMethod": "S256",
  "state": "<random-state>"
}
```

### 3. Intercambiar código por tokens

```
POST /api/v1/oauth/token
Body: {
  "grantType": "authorization_code",
  "code": "<authorization-code>",
  "codeVerifier": "<original-code-verifier>",
  "redirectUri": "http://localhost:3001/callback",
  "clientId": "spa-client"
}
```

## Formato de Respuesta

Todos los endpoints devuelven:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "message": "Operación exitosa",
  "timestamp": "2026-07-18T10:30:00Z",
  "path": "/api/v1/auth/login"
}
```

## Variables de Entorno

Ver `.env.example` para todas las variables disponibles.

## Producción

Para desplegar en un VPS:

```bash
# Compilar
pnpm run build

# Iniciar en producción
NODE_ENV=production pnpm run start:prod
```

O usa el Dockerfile proporcionado con:

```bash
docker build -t nest-api .
docker run -p 3000:3000 nest-api
```
