const sampleOutput = {
  code: "console.log('Hello World!');",
  assessment: {
    maintainability: {
      score: 85,
      reason:
        "The code follows the recommended naming conventions and modular structure.",
      suggestion: [
        {
          code: "const greeting = 'Hello World!';",
          description: "Replace console.log() with a variable assignment.",
        },
      ],
    },

    readability: {
      score: 90,

      reason:
        "The code is easy to understand due to its simple structure and descriptive variable names.",

      suggestion: [
        {
          code: "const greeting = 'Hello World!';",

          description: "Replace console.log() with a variable assignment.",
        },
      ],
    },

    efficiency: {
      score: 95,

      reason:
        "The code is efficient due to its simplicity and lack of unnecessary operations.",

      suggestion: [
        {
          code: "const greeting = 'Hello World!';",

          description: "Replace console.log() with a variable assignment.",
        },
      ],
    },

    overall_quality: {
      score: 98,

      reason:
        "The code has high maintainability, readability, and efficiency due to its simplicity and lack of unnecessary operations.",
    },
  },

  complexity: {
    time: {
      explanation:
        "The code has a time complexity of O(1) due to its simple structure and lack of any loops or recursive calls.",
    },

    space: {
      explanation:
        "The code has a space complexity of O(1) due to its simple structure and lack of any variables or data structures.",
    },
  },
};

module.exports = {
  sampleOutput,
};
