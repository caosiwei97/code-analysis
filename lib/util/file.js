const glob = require('fast-glob')
const path = require('path')

/**
 *
 * @param {String} path 要扫描的目录
 */
const scanTSFiles = (dir = '.') =>
  glob.sync(`${dir}/**/*.{ts,tsx}`, { ignore: ['**/node_modules'], dot: true, cwd: process.cwd() })

module.exports = {
  scanTSFiles,
}
