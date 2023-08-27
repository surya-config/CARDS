const vscode = require("vscode");
const { axiosInstance } = require("../axios");

async function getWebviewContent(webview, context) {
  const text = vscode.window.activeTextEditor.document.getText();

  const response = await axiosInstance.post("/hacku", {
    prompt: text || "",
  });

  const styledUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "sidebar-styles.css")
  );

  const {
    maintainability,
    readability,
    efficiency,
    maintainability_score,
    readability_score,
    efficiency_score,
    space_complexity,
    time_complexity,
    code_snippet,
  } = response.data || {
    maintainability: "",
    maintainability_score: 0,
    readability: "",
    readability_score: 0,
    efficiency: "",
    space_complexity: { explanation: "", val: 0 },
    suggestion: "",
    time_complexity: { explanation: "", val: 0 },
    code_snippet: {},
  };
  const maintainabilityScore = `${maintainability_score || 0}`;
  const readabilityScore = `${readability_score || 0}`;
  const efficiencyScore = `${efficiency_score || 0}`;

  const getScoreColor = (score) => {
    switch (true) {
      case score >= 80:
        return {
          bgColor: "#EBFAF0",
          progressColor: "#00CC66",
          color: "#208F1A",
        };
      default:
        return {
          bgColor: "#FFF7EC",
          progressColor: "#FFAA32",
          color: "#C33200",
        };
    }
  };

  function createCircularProgressBar(score, label) {
    const scoreColor = getScoreColor(score);
    return `
    <div class='progress-bar'>
        <div class='progress' data-progress=${score || ""} style="--progress: ${
      score || ""
    }%; --progressColor:${scoreColor.progressColor || ""}; --bgColor:${
      scoreColor.bgColor || ""
    }; --color:${scoreColor.color || ""};">
            ${score || ""}%
        </div>
        <h2 class='progress-label'>${label || ""}</h2>
        </div>
    `;
  }

  const maintainabilityProgressBar = createCircularProgressBar(
    maintainabilityScore,
    "Maintainability Score"
  );
  const readabilityProgressBar = createCircularProgressBar(
    readabilityScore,
    "Readability Score"
  );
  const efficiencyProgressBar = createCircularProgressBar(
    efficiencyScore,
    "Efficiency Score"
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href=${styledUri} rel="stylesheet" type="text/css" /> 
      <title>Code Metrics</title>
    </head>
    <body>
    <h1>Code Metrics</h1>
      <div class='parent-container'>
      <div class='score-container'>
     ${maintainabilityProgressBar}
     ${readabilityProgressBar}
     ${efficiencyProgressBar}
         </div>
     <div class='suggestions-container'>
     <ul>
     <h4>Maintainability</h4>
     <div class='suggestions-content'>
     ${
       maintainability
         ? maintainability
             .replace(/\n/g, "<br>")
             .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
         : ""
     }
     </div>
     </ul>
     </div>
     <div class='suggestions-container'>
     <ul>
     <h4>Readability</h4>
      <div class='suggestions-content'>
     ${
       readability
         ? readability
             .replace(/\n/g, "<br>")
             .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
         : ""
     }
     </div>
     </ul>
     </div>
      <div class='suggestions-container'>
     <ul>
     <h4>Efficiency</h4>
          <div class='suggestions-content'>
     ${
       efficiency
         ? efficiency
             .replace(/\n/g, "<br>")
             .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
         : ""
     }
     </div>
     </ul>
    <div class='suggestions-container'>
     <h4>Time Complexity</h4>
     <div class='suggestions-content'>
      <code>${time_complexity.val || 0}</code>
     ${
       time_complexity
         ? time_complexity.explanation
             .replace(/\n/g, "<br>")
             .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
         : ""
     }</div>
    </div>
   <div class='suggestions-container'>
   <h4>Space Complexity</h4>
   <div class='suggestions-content'>
   <code>${space_complexity.val || 0}</code>
   ${
     space_complexity
       ? space_complexity.explanation
           .replace(/\n/g, "<br>")
           .replace(/`([^`]+)`/g, '<span class="accent-color">$1</span>')
       : ""
   }</div>
   </div>
   <h4>Code Suggestion</h4>
  ${
    code_snippet
      ? code_snippet
          .replace(/\n/g, "<br>")
          .replace(/```([\s\S]+?)```/g, "<code>$1</code>")
      : ""
  }
   </div>
    </body>
    </html>`;
}

module.exports = { getWebviewContent };
