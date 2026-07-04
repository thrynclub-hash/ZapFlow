import pkg from '../../package.json'

// __BUILD_ID__ e injetado em tempo de build via vite.config.js (define),
// a partir de VERCEL_GIT_COMMIT_SHA (automatico em prod/preview na Vercel).
export const APP_VERSION = pkg.version
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
