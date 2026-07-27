# Lukita v2

Finanzas personales con **Astro 7 + React + Neon (Postgres) + Drizzle + Vercel**.

## Stack

- Astro 7 (SSR) + React islands
- Neon Postgres + Drizzle ORM
- Auth email/password (bcrypt) + cookie de sesión httpOnly
- UI estilo shadcn + branding Lukita

## Setup local

1. Clona el repo y entra a la carpeta.
2. Copia variables de entorno:

```bash
cp .env.example .env
```

3. Completa `.env`:

```
DATABASE_URL=postgresql://...  # connection string de Neon
SESSION_SECRET=una-cadena-larga-aleatoria-de-al-menos-32-chars
```

4. Instala e inicia el schema:

```bash
npm install
npm run db:push
npm run dev
```

5. Abre `http://localhost:4321`, regístrate y usa la app.

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desarrollo |
| `npm run build` | Build producción |
| `npm run db:push` | Aplica schema a Neon |
| `npm run db:studio` | Drizzle Studio |

## Deploy Vercel

1. Importa el repo en Vercel.
2. Framework preset: Astro.
3. Env vars: `DATABASE_URL`, `SESSION_SECRET`.
4. Tras el primer deploy, corre `npm run db:push` localmente (o desde CI) contra la misma DB.

## Funcionalidades MVP

- Auth (login / registro / logout / cambio de password)
- Cuentas (máx. 8, colores fijos)
- Categorías universales
- Movimientos unificados: gasto / ingreso / transferencia
- Ahorros (misma matriz: apartar no suma a la cuenta; gasto resta ambos)
- Dashboard: balance, periodo por día de corte, últimos N movimientos, bloque de ahorros
- Ajustes: tema, día de corte, N=5|10 recientes
- Filtros básicos en movimientos

## Fase 2 (fuera de este MVP)

- Atajos URL `/movimientos/nuevo?...` para celular
- Desglose ahorrado / disponible en cuentas

## Matriz de saldos (ahorros)

| Movimiento | Cuenta | Ahorro |
|---|---|---|
| Gasto | − | − si tiene ahorro |
| Ingreso | + | — |
| Ingreso + ahorro (apartar) | no cambia | + |
| Editar monto base del ahorro | no cambia | setea base |
