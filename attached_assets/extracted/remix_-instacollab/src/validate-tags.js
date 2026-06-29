import fs from 'fs';

const content = fs.readFileSync('src/components/layout/Shell.tsx', 'utf8');
const startIdx = content.indexOf("createStep === 'edit' && (");
const endIdx = content.indexOf("createStep === 'share' && (");
const editBlock = content.substring(startIdx, endIdx);

// Let's find all tags like <div, <video, <img, <button, <audio, <span, <Plus, <Wand2, <Scissors, <Music, <Play, <X, <Avatar
// and their matching closures </div, </video, </img, </button, </audio, </span, </Plus, </Wand2, </Scissors, </Music, </Play, </X, </Avatar
// and self-closing tags (ending with />)

const tagRegex = /<([a-zA-Z0-9_]+)(?:\s+[^>]*?)?(\/?)>/g;
const closeTagRegex = /<\/([a-zA-Z0-9_]+)>/g;

let match;
const tags = [];

// We scan line-by-line or by positions
const lines = editBlock.split('\n');

for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  
  // Find self-closing and opening tags
  let lineTagRegex = /<([a-zA-Z0-9_]+)(?:\s+[^>]*?)?(\/?)>/g;
  let m;
  while ((m = lineTagRegex.exec(line)) !== null) {
    const tagName = m[1];
    const isSelfClosing = m[2] === '/';
    if (!isSelfClosing) {
      tags.push({ type: 'open', name: tagName, line: lineNum + 1, text: m[0] });
    }
  }
  
  // Find closing tags
  let lineCloseRegex = /<\/([a-zA-Z0-9_]+)>/g;
  while ((m = lineCloseRegex.exec(line)) !== null) {
    const tagName = m[1];
    tags.push({ type: 'close', name: tagName, line: lineNum + 1, text: m[0] });
  }
}

// Sort tags by line number
tags.sort((a, b) => a.line - b.line);

// Simple stack trace
const stack = [];
for (const tag of tags) {
  if (tag.type === 'open') {
    stack.push(tag);
  } else {
    // find matching open tag from end of stack
    let found = false;
    for (let sIdx = stack.length - 1; sIdx >= 0; sIdx--) {
      if (stack[sIdx].name === tag.name) {
        stack.splice(sIdx, 1);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log('UNMATCHED CLOSING TAG:', tag.name, 'at line:', tag.line + 300);
    }
  }
}

console.log('UNCLOSED TAGS LEFT IN STACK:');
for (const tag of stack) {
  console.log('-', tag.name, 'opened at line:', tag.line + 300);
}
