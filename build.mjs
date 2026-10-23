import { build } from 'esbuild'

await build({
  entryPoints: ['app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: 'vendor/app.bundle.js',
  legalComments: 'none'
})

console.log('Built vendor/app.bundle.js with the Firebase web SDK bundled locally.')
