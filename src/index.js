import {
  dirname,
  resolve
} from 'path';

import {
  isJSXExpressionContainer,
  isStringLiteral,
  binaryExpression,
  stringLiteral,
  jSXAttribute,
  jSXExpressionContainer,
  jSXIdentifier
} from 'babel-types';
import babelPluginJsxSyntax from 'babel-plugin-syntax-jsx';

function findAttr(path, name) {
  return path.node.openingElement.attributes.find((attribute) => {
    return attribute.name !== undefined && attribute.name.name === name;
  });
}

export default function ({ Plugin, types: t }) {
  const fileDataMap = {};

  function getFileData(filename) {
    let data = fileDataMap[filename];
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
    const programPath = path.findParent((parentPath) => {
      return parentPath.isProgram();
    });

    if (data.resolveCssFuncId === null) {
      const resolveClassesIdentifier = programPath.scope.generateUidIdentifier('resolveClasses');
      data.resolveCssFuncId = programPath.scope.generateUidIdentifier('resolveLocalStyles'); 
      programPath.unshiftContainer(
        'body',
        t.importDeclaration(
          [t.importDefaultSpecifier(resolveClassesIdentifier)],
          t.stringLiteral('babel-plugin-local-styles-transformer/dist/resolveClasses')
        )
      );

      let styleNameArgId = programPath.scope.generateUidIdentifier('styleNameToResolve');
      let resolveCssFunc = t.functionDeclaration(data.resolveCssFuncId, [styleNameArgId], t.blockStatement([
        t.returnStatement(
          t.callExpression(
            resolveClassesIdentifier, [styleNameArgId, t.arrayExpression(data.styleImports)]
          )
        )  
      ]));

      let firstNonImportDeclarationNode = programPath.get('body').find((node) => {
        return !t.isImportDeclaration(node);
      });

      firstNonImportDeclarationNode.insertBefore(resolveCssFunc);
      
    }
    return data.resolveCssFuncId;
  }

  const getTargetResourcePath = (path, stats) => {
    const targetFileDirectoryPath = dirname(stats.file.opts.filename);

    if (path.node.source.value.startsWith('.')) {
      return resolve(targetFileDirectoryPath, path.node.source.value);
    }

    return require.resolve(path.node.source.value);
  };
  
  function getExtension(filename) {
    let dotIdx = filename.lastIndexOf('.');
    if (dotIdx > -1) {
      return filename.substr(dotIdx);
    }
    return null;
  }
  
  function isLocalCssImport(path, stats) {
    stats.opts.filetypes = stats.opts.filetypes || ['.css'];

    const extension = getExtension(path.node.source.value);

    for (let filetype of stats.opts.filetypes) {
      if (filetype !== extension) {
        return false;
      }
    }

    if (stats.opts.include) {
      return getTargetResourcePath(path, stats).startsWith(stats.opts.include);
    }
    return true;
  }

  return {
    inherits: babelPluginJsxSyntax,
    visitor: {
      Program (path, stats) {
        delete fileDataMap[stats.file.opts.filename];
      },
      ImportDeclaration (path, stats) {
        if (isLocalCssImport(path, stats)) {
          return;
        }
        let styleImportName;
        if (path.node.specifiers.length === 0) {
          styleImportName = path.scope.generateUidIdentifier('localStyles');
          path.node.specifiers.push(t.importDefaultSpecifier(styleImportName))
        } else {
          styleImportName = path.node.specifiers[0].local;
        }
        getFileData(stats.file.opts.filename).styleImports.push(styleImportName);
      },
      JSXElement (path, stats) {
        const filename = stats.file.opts.filename;

        const styleNameAttribute = findAttr(path, 'styleName');
        if (!styleNameAttribute) {
          return;
        }

        let data = fileDataMap[filename];
        if (!data) {
          //there is no css files imported
          return;
        }

        let resolveLocalStylesFuncId = getResolveCssFuncId(path, data);

        const classNameAttribute = findAttr(path, 'className');
        function deleteAttr(attr) {
          path.node.openingElement.attributes.splice(path.node.openingElement.attributes.indexOf(attr), 1);
        }

        if (classNameAttribute) {
          deleteAttr(classNameAttribute);
        }
        deleteAttr(styleNameAttribute);

        let expr =  isJSXExpressionContainer(styleNameAttribute.value) ? styleNameAttribute.value.expression : styleNameAttribute.value;
        let styleNameExpression = t.callExpression(resolveLocalStylesFuncId, [expr]);

        if (classNameAttribute) {
          if (isStringLiteral(classNameAttribute.value)) {
            path.node.openingElement.attributes.push(jSXAttribute(
              jSXIdentifier('className'),
              jSXExpressionContainer(
                binaryExpression(
                  '+',
                  t.stringLiteral(classNameAttribute.value.value + ' '),
                  styleNameExpression
                )
              )
            ));
          } else if (isJSXExpressionContainer(classNameAttribute.value)) {
            path.node.openingElement.attributes.push(jSXAttribute(
              jSXIdentifier('className'),
              jSXExpressionContainer(
                classMerge(
                  classNameAttribute.value.expression,
                  styleNameExpression
                )
              )
            ));
          }
        } else {
          path.node.openingElement.attributes.push(jSXAttribute(
            jSXIdentifier('className'),
            jSXExpressionContainer(
              styleNameExpression
            )
          ));
        }

      },
    }
  };
};

function classMerge(
  classNameExpression,
  styleNameExpression,
){
  return binaryExpression(
    '+',
    binaryExpression(
      '+',
      classNameExpression,
      stringLiteral(' ')
    ),
    styleNameExpression
  );
}

