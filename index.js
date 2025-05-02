// index.js
const vscode = require('vscode');

function activate(context) {
  let disposable = vscode.commands.registerCommand('extension.sayHello', function () {
    vscode.window.showInformationMessage('Hello from MineNoz!');
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
