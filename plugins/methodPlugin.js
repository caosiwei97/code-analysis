exports.methodPlugin = function (analysisContext) {
  const mapName = 'methodMap'
  // 在分析实例上下文挂载副作用
  analysisContext[mapName] = {}

  function isMethodCheck(
    context,
    tsCompiler,
    node,
    depth,
    apiName,
    matchImportItem,
    filePath,
    projectName,
    httpRepo,
    line,
  ) {
    try {
      if (node.parent && tsCompiler.isCallExpression(node.parent)) {
        // 存在于函数调用表达式中
        if (node.parent.expression.pos == node.pos && node.parent.expression.end == node.end) {
          // 命中函数名method检测
          if (!context[mapName][apiName]) {
            context[mapName][apiName] = {
              callNum: 1,
              callOrigin: matchImportItem.origin,
              callFiles: {
                [filePath]: {
                  projectName,
                  httpRepo,
                  lines: [line],
                },
              },
            }
          } else {
            context[mapName][apiName].callNum++

            if (!context[mapName][apiName].callFiles[filePath]) {
              context[mapName][apiName].callFiles[filePath] = {
                projectName,
                httpRepo,
                lines: [line],
              }
            } else {
              context[mapName][apiName].callFiles[filePath].lines.push(line)
            }
          }

          return true // true: 命中规则, 终止执行后序插件
        }
      }
      return false // false: 未命中检测逻辑, 继续执行后序插件
    } catch (e) {
      const info = {
        projectName: projectName,
        matchImportItem: matchImportItem,
        apiName: apiName,
        httpRepo: httpRepo + filePath.split('&')[1] + '#L' + line,
        file: filePath.split('&')[1],
        line: line,
        stack: e.stack,
      }
      context.addDiagnosisInfo(info)
      return false // false: 插件执行报错, 继续执行后序插件
    }
  }

  // 返回分析Node节点的函数
  return {
    mapName,
    checkFun: isMethodCheck,
    afterHook: null,
  }
}
