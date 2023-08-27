const { intializeSnippetsModule } = require("./snippets");
const { initializeDocumentation } = require("./documentation");
const {
  initializeCodeScore,
  codeAnalysisDisplosal,
} = require("./code-analysis");

let activeEditor;

async function activate(context) {
  context.subscriptions.push(initializeCodeScore(activeEditor, context));
  context.subscriptions.push(intializeSnippetsModule(context));
  context.subscriptions.push(initializeDocumentation(context));
}

function deactivate() {
  codeAnalysisDisplosal();
}

module.exports = {
  activate,
  deactivate,
};
