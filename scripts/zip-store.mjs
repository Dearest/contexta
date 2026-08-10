import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist/chrome-mv3')

const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'))
const { version } = manifest

// Chrome Web Store rejects uploads whose manifest has a "key" field — that
// field only exists locally to keep the extension ID stable across rebuilds
// (see wxt.config.ts). Strip it in a copy so the dev build stays untouched.
const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contexta-store-'))
fs.cpSync(distDir, stageDir, { recursive: true })
delete manifest.key
fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest))

const outPath = path.join(root, 'dist', `contexta-${version}-chrome-store.zip`)
fs.rmSync(outPath, { force: true })
execFileSync('zip', ['-qr', outPath, '.'], { cwd: stageDir })
fs.rmSync(stageDir, { recursive: true, force: true })

console.log(`✓ Store package (no manifest key): dist/contexta-${version}-chrome-store.zip`)
