import crx3 from 'crx3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

await crx3(
  [path.join(root, 'dist/chrome-mv3/manifest.json')],
  {
    keyPath: path.join(root, 'contexta.pem'),
    crxPath: path.join(root, 'contexta.crx'),
  }
)

console.log('✓ Packed to contexta.crx')
