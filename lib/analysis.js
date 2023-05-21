const path = require('path')
const { parseTs } = require('./parser') // 解析模块
const fileHelper = require('./util/file')
const tsCompiler = require('typescript')

class CodeAnalysis {
  constructor(options = {}) {
    // 私有属性
    this._scanSource = options.scanSource // 扫描源配置信息
    this._analysisTarget = options.analysisTarget || 'mod' // 要分析的目标依赖配置
    this._blackList = options.blackList || [] // 需要标记的黑名单API配置
    this._scorePlugin = options.scorePlugin || null // 代码评分插件配置
    this._analysisPlugins = options.analysisPlugins || [] // 代码分析插件配置
    // 公共属性
    this.pluginsQueue = [] // Targer分析插件队列
    this.browserQueue = [] // Browser分析插件队列
    this.importItemMap = {} // importItem统计Map
    // this.apiMap = {};                                       // 未分类API统计Map（插件挂载）
    // this.typeMap = {};                                      // 类型API统计Map（插件挂载）
    // this.methodMap = {};                                    // 方法API统计Map（插件挂载）
    // this.browserMap = {};                                   // BrowserAPI统计Map（插件挂载）
    this.parseErrorInfos = [] // 解析异常信息数组
    this.diagnosisInfos = [] // 诊断日志信息数组
    this.scoreMap = {} // 代码评分及建议Map
  }
  // API黑名单标记
  _blackTag() {}
  // 注册插件
  _installPlugins() {
    console.log('安装插件')
  }
  // 链式调用检查，找出链路顶点node
  _checkPropertyAccess(node, index = 0, apiName = '') {
    if (index) {
      apiName = apiName + '.' + node.name.escapedText
    } else {
      apiName = apiName + node.escapedText
    }

    if (tsCompiler.isPropertyAccessExpression(node.parent)) {
      return this._checkPropertyAccess(node.parent, ++index, apiName)
    } else {
      return {
        baseNode: node,
        depth: index,
        apiName,
      }
    }
  }
  // 执行分析插件队列中的checkFun函数
  _runAnalysisPlugins() {}
  // 执行分析插件队列中的afterHook函数
  _runAnalysisPluginsHook() {}
  // 分析import节点
  _findImportItems(ast) {
    let importItems = {}
    let that = this

    // 处理imports相关map
    function dealImports(importItem) {
      // 处理importItems
      importItems[importItem.name] = {}
      importItems[importItem.name].origin = importItem.origin
      importItems[importItem.name].symbolPos = importItem.symbolPos
      importItems[importItem.name].symbolEnd = importItem.symbolEnd
      importItems[importItem.name].identifierPos = importItem.identifierPos
      importItems[importItem.name].identifierEnd = importItem.identifierEnd
    }

    // 遍历AST寻找import节点
    function walk(node) {
      tsCompiler.forEachChild(node, walk)

      // 获取当前节点的行列信息
      const line = ast.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const importClause = node.importClause
      const namedBindings = importClause?.namedBindings

      // 分析 import 节点，且必须匹配目标有导出的模块
      if (tsCompiler.isImportDeclaration(node) && node.moduleSpecifier?.text == that._analysisTarget && importClause) {
        // 1.默认导入 import x from 'x'
        if (importClause.name) {
          dealImports({
            name: importClause.name.escapedText,
            origin: null,
            symbolPos: importClause.pos,
            symbolEnd: importClause.end,
            identifierPos: importClause.name.pos,
            identifierEnd: importClause.name.end,
            line,
          })
        }

        // 2.局部导入 import {x, xx as xxx} from 'x'
        if (namedBindings && tsCompiler.isNamedImports(namedBindings) && namedBindings.elements?.length) {
          namedBindings.elements.forEach((element) => {
            if (tsCompiler.isImportSpecifier(element)) {
              dealImports({
                name: element.name.escapedText,
                // propertyName 用于区分是否使用了 as 别名
                origin: element.propertyName ? element.propertyName.escapedText : null,
                symbolPos: element.pos,
                symbolEnd: element.end,
                identifierPos: element.name.pos,
                identifierEnd: element.name.end,
                line: line,
              })
            }
          })
        }

        // 3.命名空间导入 import * as from 'x'
        if (namedBindings && tsCompiler.isNamespaceImport(namedBindings) && namedBindings.name) {
          dealImports({
            name: namedBindings.name.escapedText,
            origin: '*',
            symbolPos: namedBindings.pos,
            symbolEnd: namedBindings.end,
            identifierPos: namedBindings.name.pos,
            identifierEnd: namedBindings.name.end,
            line,
          })
        }
      }
    }

    walk(ast)

    return importItems
  }
  // API调用分析
  _dealAST(importItems, ast, checker) {
    const that = this
    const importItemNames = Object.keys(importItems)

    // 遍历AST
    function walk(node) {
      tsCompiler.forEachChild(node, walk)

      // 1.排除 import identifier
      // 2.排除局部同名 identifier
      if (tsCompiler.isIdentifier(node) && node.escapedText && importItemNames.length && importItemNames.includes(node.escapedText)) {
        // 命中Target Api Item Name
        const matchImportItem = importItems[node.escapedText]

        if (node.pos != matchImportItem.identifierPos && node.end != matchImportItem.identifierEnd) {
          const symbol = checker.getSymbolAtLocation(node)

          if (symbol?.declarations?.length) {
            // 存在上下文声明
            const nodeSymbol = symbol.declarations[0]

            if (matchImportItem.symbolPos == nodeSymbol.pos && matchImportItem.symbolEnd == nodeSymbol.end) {
              // Identifier节点如果没有parent属性，说明AST节点语义异常，不存在分析意义
              if (node.parent) {
                const { baseNode, depth, apiName } = that._checkPropertyAccess(node) // 获取基础分析节点信息

                console.log(apiName)

                // that._runAnalysisPlugins(tsCompiler, baseNode, depth, apiName, matchImportItem, filePath, projectName, httpRepo, line) // 执行分析插件
              }
            } else {
              // 上下文非importItem API但与其同名的Identifier节点
            }
          }
        }
      }
    }
    walk(ast)
    // AST遍历结束，执行afterhook
    this._runAnalysisPluginsHook()
  }

  // 扫描代码文件
  _scanFiles(scanSources, type) {
    return scanSources.map(({ name = '', httpRepo = '', paths = [] }) => {
      return {
        name,
        httpRepo,
        parseFiles: paths.map(fileHelper.scanTSFiles).flat(),
      }
    })
  }
  // 扫描代码文件 & 分析代码
  _scanCode(scanSources, type) {
    // 扫描所有需要分析的代码文件
    const entries = this._scanFiles(scanSources, type)
    // 遍历每个文件，依次（解析AST，分析import，分析API调用）
    entries.forEach(({ parseFiles }) => {
      // 将TS代码文件解析为 AST
      if (parseFiles.length) {
        parseFiles.forEach((file) => {
          const { ast, checker } = parseTs(file)
          // 遍历 AST 分析 import 节点
          const importItems = this._findImportItems(ast)
          // console.log(importItems)

          if (Object.keys(importItems).length) {
            // 遍历 AST 分析 API 调用
            this._dealAST(importItems, ast, checker)
          }
        })
      }
    })
  }
  // 记录诊断日志
  addDiagnosisInfo() {}
  // 入口函数
  analysis() {
    // 注册插件
    // this._installPlugins()
    // 扫描分析代码
    this._scanCode([{ name: 'foo', httpRepo: 'https://github.com', paths: ['test'] }])
    // 黑名单标记
    // this._blackTag()
    // 代码评分
    // this._scorePlugin()
  }
}

new CodeAnalysis().analysis()
