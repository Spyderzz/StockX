require('@babel/register')({
  presets: ['@babel/preset-react', '@babel/preset-env']
});

const React = require('react');
const { renderToString } = require('react-dom/server');

// Mock external things
global.COLOR_MAP = {
  emerald: { text: 'text-emerald', hex: '#10B981' },
  warn: { text: 'text-warn', hex: '#F59E0B' },
  danger: { text: 'text-danger', hex: '#EF4444' },
}

const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AnalysePage.jsx', 'utf8');

// Just mock the components from AnalysePage
const matches = code.match(/function MLCard.*?(?=function TechStatsStrip)/s);
const mlCardCode = matches[0];

const techMatches = code.match(/function TechStatsStrip.*?(?=function StockHoldingsCard)/s);
const techCode = techMatches[0];

const stockMatches = code.match(/function StockHoldingsCard.*?(?=function FiiDiiCard)/s);
const stockCode = stockMatches[0];

eval(babelTransform(mlCardCode));
eval(babelTransform(techCode));
eval(babelTransform(stockCode));

function babelTransform(c) {
  return require('@babel/core').transformSync(c, { presets: ['@babel/preset-react'] }).code;
}

try {
  console.log("Rendering MLCard...");
  renderToString(React.createElement(MLCard, { dim: { type: 'xgb', color: 'danger', score: 50, setup_label: 'POOR SETUP', setup_color: 'red' } }));
  console.log("MLCard OK");
} catch (e) { console.error("MLCard ERROR:", e.message); }

try {
  console.log("Rendering TechStatsStrip...");
  renderToString(React.createElement(TechStatsStrip, { tech: {} }));
  console.log("TechStatsStrip OK");
} catch (e) { console.error("TechStatsStrip ERROR:", e.message); }

try {
  console.log("Rendering StockHoldingsCard...");
  renderToString(React.createElement(StockHoldingsCard, { holdings: {}, symbol: 'INFY' }));
  console.log("StockHoldingsCard OK");
} catch (e) { console.error("StockHoldingsCard ERROR:", e.message); }

