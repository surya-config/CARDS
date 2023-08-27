const vscode = require("vscode");
const snippetFunctions = require("./helpers");

let snippets = [];

function intializeSnippetsModule(context) {
  vscode.commands.registerCommand("extension.showSnippets", () => {
    showSnippetManager(context);
  });
}

async function showSnippetManager(context) {
  const snippetsList = snippetFunctions.getSnippets();

  const panel = vscode.window.createWebviewPanel(
    "snippetManagerSidebar",
    "Snippet Manager",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
    }
  );

  // Load content into the webview
  panel.webview.html = getWebviewContent(snippetsList);

  panel.webview.onDidReceiveMessage((message) => {
    console.log("Message received: ", message);
    if (message.command === "addSnippet") {
      addSnippet(message.name, message.description);
    } else if (message.command === "deleteSnippet") {
      deleteSnippet(message.index);
    }

    // Send updated snippets to the webview
    panel.webview.postMessage({ command: "updateSnippets", snippets });
  });
}

// Function to generate webview content
function getWebviewContent(snippetsList) {
  // Create an HTML table to display snippets
  function getSnippetRow(snippet) {
    return `
    <tr>
      <td>${snippet.name}</td>
      <td>${snippet.explanation}</td>
      <td>
        <button onclick="${copySnippet(
          snippets.indexOf(snippet)
        )})">Copy</button>
      </td>
    </tr>
  `;
  }

  function copySnippet(index) {
    const snippet = snippets[index];
    const snippetWithExplanation = `/*\n${snippet.explanation}\n*/\n${snippet.code}`;
    console.log(snippetWithExplanation);
    // vscode.postMessage({
    //   command: "copySnippet",
    //   content: snippetWithExplanation,
    // });
  }

  return `
    <!DOCTYPE html>
    <html>
    <body>
      <h2>Snippet Manager</h2>
      <button id="addButton">Add Snippet</button>
       <table id="snippetTable">
          <tr>
            <th>Name</th>
            <th>Explanation</th>
            <th>Actions</th>
          </tr>
          ${snippets.map(getSnippetRow).join("")}
        </table>
      <div id="inputForm" style="display: none;">
        <h3>Add Snippet</h3>
        <input type="text" id="nameInput" placeholder="Name" />
        <input type="text" id="explanationInput" placeholder="Explanation" />
        <textarea id="codeInput" placeholder="Code"></textarea>
        <button id="submitButton" type="submit" onclick="handleAddition()">Add</button>
      </div>
      <script>
        const snippetTable = document.getElementById("snippetTable");
        const inputForm = document.getElementById("inputForm");
        const nameInput = document.getElementById("nameInput");
        const explanationInput = document.getElementById("explanationInput");
        const codeInput = document.getElementById("codeInput");
        const submitButton = document.getElementById("submitButton");
        
        function handleAddition() {
          console.log("Addition call");
            vscode.postMessage({
              command: "addSnippet",
              name,
              explanation,
              code,
            });
        }

        addButton.addEventListener("click", () => {
          inputForm.style.display = "block";
        });

        submitButton.addEventListener("click", () => {
          const name = nameInput.value;
          const explanation = explanationInput.value;
          const code = codeInput.value;
          console.log({name, explanation, code})
          vscode.postMessage({
            command: "addSnippet",
            name,
            explanation,
            code,
          });
          inputForm.style.display = "none";
          nameInput.value = "";
          explanationInput.value = "";
          codeInput.value = "";
        });
      </script>
    </body>
    </html>
  `;
}

// Function to add a snippet
function addSnippet(name, description) {
  snippets.push({ name, description });
}

// Function to delete a snippet
function deleteSnippet(index) {
  snippets.splice(index, 1);
}

module.exports = {
  intializeSnippetsModule,
  showSnippetManager,
};
