const vscode = require("vscode");
const { getWebviewContent } = require("./customWebview");

async function createCustomSidebar(context) {
  const panel = vscode.window.createWebviewPanel(
    "codeScore",
    "Code Metrics",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  const styledUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "sidebar-styles.css")
  );

  panel.webview.html = `
    <html>
    <head>
      <link href=${styledUri} rel="stylesheet" type="text/css" /> 
    </head>
    <body>
      <h1>Code Metrics</h1>
      <div class="loader-container">
        <div class="loader"></div>
      </div>
    </body>
    </html>
  `;

  const htmlContent = await getWebviewContent(panel.webview, context);
  panel.webview.html = htmlContent;
}

module.exports = {
  createCustomSidebar,
};
