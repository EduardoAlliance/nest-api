# NestJS API — Backend de Autenticación y Gestión de Usuarios

Backend REST desarrollado con **NestJS y TypeScript** que provee autenticación segura y administración de usuarios para aplicaciones web modernas. Está diseñado para funcionar como API independiente de un frontend SPA (por ejemplo, React), aplicando buenas prácticas de arquitectura, validación y seguridad.

El sistema permite que los usuarios se registren e inicien sesión con sus credenciales, mantengan sesiones seguras mediante tokens de acceso y renovación, y que los administradores gestionen el ciclo de vida completo de las cuentas.

---

## ¿Qué resuelve?

- Centraliza la autenticación y la gestión de identidades en un solo servicio.
- Desacopla el backend del frontend mediante una API REST documentada.
- Protege las operaciones administrativas con permisos por rol.
- Ofrece una base escalable y mantenible para productos que necesitan cuentas de usuario.

---

## Características principales

- **Registro e inicio de sesión** con email y contraseña.
- **Sesiones con JWT**: token de acceso de corta duración y token de renovación seguro en cookie HttpOnly.
- **Renovación de sesión** sin volver a solicitar credenciales, con rotación de tokens.
- **Recuperación y cambio de contraseña** por correo.
- **Verificación de email** con enlaces al frontend.
- **Gestión de usuarios**: crear, listar, consultar, actualizar, eliminar y restaurar.
- **Eliminación lógica** para conservar el historial de las cuentas.
- **Control de acceso por roles** (administrador, usuario y moderador).
- **Validación automática** de los datos de entrada.
- **Respuestas estandarizadas** y manejo centralizado de errores.
- **Documentación interactiva** de la API con Swagger.
- **Registro de actividad y errores** con Winston.
- **Caché de consultas** para mejorar el rendimiento.
- **Entorno reproducible** con Docker.

---

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Lenguaje | TypeScript |
| Framework | NestJS 11 |
| Base de datos | MySQL 8 |
| ORM | TypeORM |
| Autenticación | JWT + Passport |
| Documentación | Swagger / OpenAPI |
| Logging | Winston |
| Caché | Cache Manager |
| Contenedores | Docker y Docker Compose |
| Gestor de paquetes | pnpm |

---

## Arquitectura

El proyecto sigue una **arquitectura modular**, donde cada responsabilidad está separada en su propio módulo:

- **Autenticación:** login, registro, renovación de sesión, cierre de sesión y recuperación de contraseña.
- **Usuarios:** administración de cuentas y perfil del usuario autenticado.
- **Módulo común:** controles de acceso, validaciones, manejo de errores y formato uniforme de respuestas.
- **Configuración:** centralización de variables de entorno para base de datos, seguridad, correo y aplicación.
- **Logging:** registro estructurado de eventos y errores.

Esta organización facilita el mantenimiento, las pruebas y la incorporación de nuevas funcionalidades sin afectar el resto del sistema.

---

## Seguridad

- Contraseñas almacenadas con **hash bcrypt**, nunca en texto plano.
- Tokens **JWT firmados** con expiración definida.
- Refresh token en **cookie HttpOnly** con rotación y detección de reutilización.
- **Control de acceso por roles** aplicado de forma global.
- **Validación y filtrado** de los datos que ingresan a la API.
- **Límite de peticiones** para mitigar abusos.
- Cabeceras de seguridad con **Helmet**.
- **CORS configurable** para permitir únicamente los orígenes autorizados.
- **Soft delete** para evitar la pérdida definitiva de información.

---

## Roles y permisos

| Rol | Alcance |
|-----|---------|
| **Administrador** | Gestión completa de usuarios y acceso a todas las operaciones administrativas. |
| **Usuario** | Acceso a su propio perfil y a las funcionalidades disponibles para su cuenta. |
| **Moderador** | Rol definido en el sistema, reservado para futuras capacidades de moderación. |

---

## Alcance funcional de la API

La API expone dos grandes áreas:

**Autenticación**
- Registro de nuevos usuarios.
- Inicio y cierre de sesión.
- Renovación del token de acceso.
- Solicitud y aplicación de reseteo de contraseña.
- Verificación de email.

**Usuarios**
- Consulta y actualización del perfil propio.
- Creación, listado paginado, detalle, actualización y eliminación de usuarios.
- Restauración de usuarios eliminados.
- Búsqueda y filtros por nombre, email, rol y estado.

Todas las operaciones administrativas requieren rol de administrador.

---

## Puesta en marcha

1. Tener instalados **Node.js 20+**, **pnpm** y, opcionalmente, **Docker**.
2. Copiar el archivo de variables de entorno de ejemplo y ajustar las credenciales.
3. Levantar los servicios con Docker Compose, o instalar dependencias e iniciar el proyecto en modo desarrollo.
4. Ejecutar el seeder para crear el usuario administrador inicial.
5. Acceder a la documentación interactiva de la API.

**Usuario administrador de prueba**

- Email: `admin@example.com`
- Contraseña: `Admin123!`

---

## Documentación de la API

La documentación interactiva está disponible en:

`http://localhost:3000/api/docs`

Desde Swagger se pueden consultar los endpoints, los modelos de datos y probar las operaciones con autenticación.


## Despliegue

El proyecto puede compilarse para producción y ejecutarse directamente con Node.js o dentro de un contenedor Docker. La configuración de variables de entorno permite adaptar la aplicación a distintos entornos sin modificar el código.

---

## Resumen

**NestJS API** es una base backend completa para productos que necesitan autenticación, gestión de usuarios y permisos por rol, construida con tecnologías actuales y criterios de seguridad y mantenibilidad aptos para un entorno profesional.
