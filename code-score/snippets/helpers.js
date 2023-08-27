const vscode = require("vscode");
let snippets = [];

function addSnippet(name, description, code) {
  snippets.push({ name, description, code });
  // vscode.postMessage({ command: "updateSnippets" });
}

function editSnippet(index, name, description, code) {
  if (index >= 0 && index < snippets.length) {
    snippets[index] = { name, description, code };
  }
}

function deleteSnippet(index) {
  if (index >= 0 && index < snippets.length) {
    snippets.splice(index, 1);
  }
}

function getSnippets() {
  return snippets;
}

module.exports = {
  addSnippet,
  editSnippet,
  deleteSnippet,
  getSnippets,
};
