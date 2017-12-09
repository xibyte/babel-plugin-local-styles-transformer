'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (_ref) {
  var Plugin = _ref.Plugin,
      t = _ref.types;

  var fileDataMap = {};

  function getFileData(filename) {
    var data = fileDataMap[filename];
    if (!data) {
      data = {
        styleImports: [],
        resolveCssFuncId: null
      };
      fileDataMap[filename] = data;
    }
    return data;
  }

  function getResolveCssFuncId(path, data) {
    var programPath = path.findParent(function (parentPath) {
      return parentPath.isProgram();
    });

    if (data.resolveCssFuncId === null) {
      var resolveClassesIdentifier = programPath.scope.generateUidIdentifier('resolveClasses');
      data.resolveCssFuncId = programPath.scope.generateUidIdentifier('resolveLocalStyles');
      programPath.unshiftContainer('body', t.importDeclaration([t.importDefaultSpecifier(resolveClassesIdentifier)], t.stringLiteral('babel-plugin-local-styles-transformer/dist/resolveClasses')));

      var styleNameArgId = programPath.scope.generateUidIdentifier('styleNameToResolve');
      var resolveCssFunc = t.functionDeclaration(data.resolveCssFuncId, [styleNameArgId], t.blockStatement([t.returnStatement(t.callExpression(resolveClassesIdentifier, [styleNameArgId, t.arrayExpression(data.styleImports)]))]));

      var firstNonImportDeclarationNode = programPath.get('body').find(function (node) {
        return !t.isImportDeclaration(node);
      });

      firstNonImportDeclarationNode.insertBefore(resolveCssFunc);
    }
    return data.resolveCssFuncId;
  }

  var getTargetResourcePath = function getTargetResourcePath(path, stats) {
    var targetFileDirectoryPath = (0, _path.dirname)(stats.file.opts.filename);

    if (path.node.source.value.startsWith('.')) {
      return (0, _path.resolve)(targetFileDirectoryPath, path.node.source.value);
    }

    return require.resolve(path.node.source.value);
  };

  function getExtension(filename) {
    var dotIdx = filename.lastIndexOf('.');
    if (dotIdx > -1) {
      return filename.substr(dotIdx);
    }
    return null;
  }

  function isLocalCssImport(path, stats) {
    stats.opts.filetypes = stats.opts.filetypes || ['.css'];

    var extension = getExtension(path.node.source.value);

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = stats.opts.filetypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var filetype = _step.value;

        if (filetype !== extension) {
          return false;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    if (stats.opts.include) {
      return getTargetResourcePath(path, stats).startsWith(stats.opts.include);
    }
    return true;
  }

  return {
    inherits: _babelPluginSyntaxJsx2.default,
    visitor: {
      Program: function Program(path, stats) {
        delete fileDataMap[stats.file.opts.filename];
      },
      ImportDeclaration: function ImportDeclaration(path, stats) {
        if (isLocalCssImport(path, stats)) {
          return;
        }
        var styleImportName = void 0;
        if (path.node.specifiers.length === 0) {
          styleImportName = path.scope.generateUidIdentifier('localStyles');
          path.node.specifiers.push(t.importDefaultSpecifier(styleImportName));
        } else {
          styleImportName = path.node.specifiers[0].local;
        }
        getFileData(stats.file.opts.filename).styleImports.push(styleImportName);
      },
      JSXElement: function JSXElement(path, stats) {
        var filename = stats.file.opts.filename;

        var styleNameAttribute = findAttr(path, 'styleName');
        if (!styleNameAttribute) {
          return;
        }

        var data = fileDataMap[filename];
        if (!data) {
          //there is no css files imported
          return;
        }

        var resolveLocalStylesFuncId = getResolveCssFuncId(path, data);

        var classNameAttribute = findAttr(path, 'className');
        function deleteAttr(attr) {
          path.node.openingElement.attributes.splice(path.node.openingElement.attributes.indexOf(attr), 1);
        }

        if (classNameAttribute) {
          deleteAttr(classNameAttribute);
        }
        deleteAttr(styleNameAttribute);

        var expr = (0, _babelTypes.isJSXExpressionContainer)(styleNameAttribute.value) ? styleNameAttribute.value.expression : styleNameAttribute.value;
        var styleNameExpression = t.callExpression(resolveLocalStylesFuncId, [expr]);

        if (classNameAttribute) {
          if ((0, _babelTypes.isStringLiteral)(classNameAttribute.value)) {
            path.node.openingElement.attributes.push((0, _babelTypes.jSXAttribute)((0, _babelTypes.jSXIdentifier)('className'), (0, _babelTypes.jSXExpressionContainer)((0, _babelTypes.binaryExpression)('+', t.stringLiteral(classNameAttribute.value.value + ' '), styleNameExpression))));
          } else if ((0, _babelTypes.isJSXExpressionContainer)(classNameAttribute.value)) {
            path.node.openingElement.attributes.push((0, _babelTypes.jSXAttribute)((0, _babelTypes.jSXIdentifier)('className'), (0, _babelTypes.jSXExpressionContainer)(classMerge(classNameAttribute.value.expression, styleNameExpression))));
          }
        } else {
          path.node.openingElement.attributes.push((0, _babelTypes.jSXAttribute)((0, _babelTypes.jSXIdentifier)('className'), (0, _babelTypes.jSXExpressionContainer)(styleNameExpression)));
        }
      }
    }
  };
};

var _path = require('path');

var _babelTypes = require('babel-types');

var _babelPluginSyntaxJsx = require('babel-plugin-syntax-jsx');

var _babelPluginSyntaxJsx2 = _interopRequireDefault(_babelPluginSyntaxJsx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function findAttr(path, name) {
  return path.node.openingElement.attributes.find(function (attribute) {
    return attribute.name !== undefined && attribute.name.name === name;
  });
}

;

function classMerge(classNameExpression, styleNameExpression) {
  return (0, _babelTypes.binaryExpression)('+', (0, _babelTypes.binaryExpression)('+', classNameExpression, (0, _babelTypes.stringLiteral)(' ')), styleNameExpression);
}