const path = require('path');
const { CodeParser } = require('../extension/dist/dependency/codeParser');

async function testParser() {
    const parser = new CodeParser();
    
    console.log('=== Testing HTML Import Parsing ===');
    const htmlResult = await parser.parseFile(path.join(__dirname, 'index.html'));
    console.log('HTML Imports:', JSON.stringify(htmlResult.imports, null, 2));
    console.log('HTML Functions:', JSON.stringify(htmlResult.functions, null, 2));
    
    console.log('\n=== Testing CSS Import Parsing ===');
    const cssResult = await parser.parseFile(path.join(__dirname, 'styles.css'));
    console.log('CSS Imports:', JSON.stringify(cssResult.imports, null, 2));
    
    console.log('\n=== Testing JavaScript Function Calls ===');
    const jsResult = await parser.parseFile(path.join(__dirname, 'main.js'));
    console.log('JS Functions:', JSON.stringify(jsResult.functions, null, 2));
    console.log('JS Function Calls:', JSON.stringify(jsResult.functionCalls, null, 2));
    
    console.log('\n=== Summary ===');
    console.log(`HTML found ${htmlResult.imports.length} imports`);
    console.log(`CSS found ${cssResult.imports.length} imports`);
    console.log(`JS found ${jsResult.functions.length} functions`);
    console.log(`JS found ${jsResult.functionCalls.length} function calls`);
}

testParser().catch(console.error);

// Made with Bob
