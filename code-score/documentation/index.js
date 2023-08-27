const vscode = require("vscode");
const { axiosInstance } = require("../axios");

function initializeDocumentation(context) {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "*", // Language ID
      {
        provideCodeActions: (document, range) => {
          const selectedText = document.getText(range);

          // Create a code action to trigger opening the web view
          const codeAction = new vscode.CodeAction(
            "Open Documentation",
            vscode.CodeActionKind.Empty
          );
          codeAction.command = {
            title: "Open Documentation",
            command: "extension.openDocumentationWebView", // Command name
            arguments: [selectedText], // Pass selectedText as an argument
          };

          return [codeAction];
        },
      }
    )
  );

  // Register the command and web view panel creation
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.openDocumentationWebView",
      (selectedText) => {
        openDocumentationWebView(selectedText, context);
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.closeDocumentationWebView",
      () => {
        closeDocumentationWebView();
      }
    )
  );
}

async function openDocumentationWebView(selectedText, context) {
  const panel = vscode.window.createWebviewPanel(
    "documentation", // Identifies the type of the webview
    "Documentation", // Title displayed to the user
    vscode.ViewColumn.Beside, // Editor column to show the webview panel in
    {}
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
      <h1>Documentation</h1>
      <div class="loader-container">
        <div class="loader"></div>
      </div>
    </body>
    </html>
    `;

  const editor = vscode.window.activeTextEditor;
  const code = selectedText || editor.document;

  const response = await axiosInstance.post("/hacku/docu", {
    prompt: code,
  });

  // Set the webview's HTML content
  const documentation = generateDocumentation(response.data.documentation);
  if (documentation) {
    panel.webview.html = documentation;
  } else {
    panel.webview.html = `
    <html>
    <body>
    <h1>Documentation</h1>
    <h4>Could not analyze the code, please try again.</h4>
    </body>
    </html>
    `;
  }
}

function generateDocumentation(doc) {
  return `<html>
  <head>
  <style>
  .documentation-container {
    padding: 1rem;
    border: 1px solid #e4e7ec;
    border-radius: 0.5rem;
    line-height: 21px;
  }
  .accent-color {
    color: aqua;
  }
  </style>
  </head>
  <body>
    <h1>Documentation</h1>
   <div class="documentation-container">
   ${
     !!doc
       ? doc
           .replace(/\n/g, "<br>")
           .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
       : "<h4>Analyzing the code ...</h4>"
   }
   </div>
  </body></html>`;
}

function closeDocumentationWebView() {
  //  if (documentationPanel) {
  //     documentationPanel.dispose();
  //     documentationPanel = undefined; // Reset the panel reference
  //  }
}

module.exports = {
  initializeDocumentation,
};
