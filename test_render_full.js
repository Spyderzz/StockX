require('@babel/register')({
  presets: ['@babel/preset-react', '@babel/preset-env']
});

const React = require('react');
const { renderToString } = require('react-dom/server');
const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/AnalysePage.jsx', 'utf8');

// Strip out imports and exports to evaluate
code = code.replace(/import.*?['"];?/g, '');
code = code.replace(/export default.*?function/, 'function');

eval(require('@babel/core').transformSync(code, { presets: ['@babel/preset-react'] }).code);

// Run the transformation
const mockData = JSON.parse(fs.readFileSync('/tmp/response.json', 'utf8'));
const result = transformApiResult(mockData);

try {
  console.log("Rendering ResultCard...");
  renderToString(React.createElement(ResultCard, { result, loading: false }));
  console.log("ResultCard OK");
} catch (e) { console.error("ResultCard ERROR:", e.stack); }
