import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  // Se guarda en resources/ para que viaje (sin empaquetar en el asar) con el instalador
  out: './resources/migrations'
})
