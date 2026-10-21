import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'server/index': 'src/server/index.ts',
    'embed/index': 'src/embed/index.ts',
    'payload/index': 'src/payload/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['payload'],
})
