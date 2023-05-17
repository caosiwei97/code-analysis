const glob = require('fast-glob')
const path = require('path')

/**
 *
 * @param {String} path 要扫描的目录
 */
const scanTSFiles = (dir = '.') =>
  glob.sync(path.join(process.cwd(), `${dir}/**/*.{ts,tsx}`))

module.exports = {
  scanTSFiles,
}
