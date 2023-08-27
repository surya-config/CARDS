const vscode = require("vscode");
const { createCustomSidebar } = require("../sidebar/sidebar");
const { axiosInstance } = require("../axios");

let codeScoreStatusBarItem;

async function initializeCodeScore(activeEditor, context) {
  console.log("Code Analysis extension is now active.");
  let score;

  codeScoreStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  codeScoreStatusBarItem.tooltip = "Code Score";
  codeScoreStatusBarItem.text = "$(list-flat) Open Sidebar";

  vscode.workspace.onDidSaveTextDocument(async () => {
    if (activeEditor) {
      score = await analyzeCode(activeEditor.document);
    }
  });
  codeScoreStatusBarItem.command = "extension.openWebview";
  codeScoreStatusBarItem.show();

  activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    context.subscriptions.push(
      vscode.commands.registerCommand("extension.openWebview", async () => {
        await createCustomSidebar(context);
      })
    );
  }
}

async function analyzeCode(document) {
  const text = document.getText();

  codeScoreStatusBarItem.text = "Analyzing code to generate score";
  codeScoreStatusBarItem.show();
  const response = await axiosInstance.post("/hacku/score", {
    prompt: text,
  });

  const codeScore = response.data.overall_score || 0;
  // Ensure score is not negative
  codeScoreStatusBarItem.text = `Score: ${response.data.overall_score || 0}`;
  codeScoreStatusBarItem.show();
  return codeScore;
}

function codeAnalysisDisplosal() {
  // codeScoreStatusBarItem.dispose();
}

module.exports = {
  initializeCodeScore,
  analyzeCode,
  codeAnalysisDisplosal,
};
