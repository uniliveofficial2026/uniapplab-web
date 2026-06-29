import fs from 'fs';

const content = fs.readFileSync('src/components/layout/Shell.tsx', 'utf8');

// Let's trace braces { } and parentheses ( ) starting from "createStep === 'edit'"
const startIdx = content.indexOf("createStep === 'edit' && (");
console.log('Start index:', startIdx);

let braces = 1; // since we start inside '{'
let parens = 0;
let inQuote = false;
let quoteChar = '';

let i = startIdx + "createStep === 'edit' && (".length - 1; // at '('
parens = 1; // since we matched '('

const lines = content.split('\n');

function getLineAndCol(pos) {
  let cur = 0;
  for (let l = 0; l < lines.length; l++) {
    if (cur + lines[l].length + 1 > pos) {
      return { line: l + 1, col: pos - cur + 1, text: lines[l] };
    }
    cur += lines[l].length + 1;
  }
  return { line: -1, col: -1, text: '' };
}

while (i < content.length) {
  i++;
  const char = content[i];
  
  if (inQuote) {
    if (char === quoteChar && content[i - 1] !== '\\') {
      inQuote = false;
    }
    continue;
  }
  
  if (char === '"' || char === "'" || char === '`') {
    inQuote = true;
    quoteChar = char;
    continue;
  }
  
  if (char === '{') {
    braces++;
  } else if (char === '}') {
    braces--;
  } else if (char === '(') {
    parens++;
  } else if (char === ')') {
    parens--;
  }
  
  if (braces === 0) {
    console.log('Braces matched first! Ended at position:', i, getLineAndCol(i));
    break;
  }
  if (parens === 0 && braces === 1) {
    console.log('Parens matched when braces=1! Ended at position:', i, getLineAndCol(i));
    if (content[i + 1] === '}') {
      console.log('Braces closed immediately after at:', i + 1, getLineAndCol(i + 1));
      break;
    }
  }
}
