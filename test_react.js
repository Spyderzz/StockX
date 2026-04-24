const { readFileSync } = require('fs');
const babel = require('@babel/core');

const code = readFileSync('frontend/src/pages/AnalysePage.jsx', 'utf8');

console.log("Analyzing AnalysePage.jsx...");

// just check if babel parses it correctly
try {
  babel.transformSync(code, {
    presets: ['@babel/preset-react']
  });
  console.log("BABEL COMPILES FINE");
} catch (e) {
  console.error("BABEL ERROR:", e.message);
}
