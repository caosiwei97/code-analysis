const tsCompiler = require('typescript')

// 解析ts文件代码，获取ast，checker
const parseTs = function (fileName) {
  const program = tsCompiler.createProgram({
    rootNames: [fileName],
    options: {},
  })

  // 将ts代码转化为AST
  const ast = program.getSourceFile(fileName)
  const checker = program.getTypeChecker()
  return { ast, checker }
}

module.exports = {
  parseTs,
}
