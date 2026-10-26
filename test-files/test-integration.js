const path = require('path');
const { GraphBuilder } = require('../extension/dist/dependency/graphBuilder');

async function testIntegration() {
    const workspaceRoot = path.join(__dirname);
    const graphBuilder = new GraphBuilder(workspaceRoot);
    
    // Test files
    const files = [
        path.join(__dirname, 'index.html'),
        path.join(__dirname, 'styles.css'),
        path.join(__dirname, 'main.js')
    ];
    
    console.log('=== Building Full Dependency Graph ===');
    const graph = await graphBuilder.buildGraph(files);
    
    console.log('\n=== Nodes ===');
    graph.nodes.forEach(node => {
        console.log(`\n${node.type.toUpperCase()}: ${node.name} (${node.id})`);
        if (node.children && node.children.length > 0) {
            console.log('  Children:');
            node.children.forEach(child => {
                console.log(`    - ${child.type}: ${child.name} (line ${child.line || 'N/A'})`);
            });
        }
    });
    
    console.log('\n=== Edges ===');
    graph.edges.forEach(edge => {
        console.log(`${edge.from} --[${edge.type}]--> ${edge.to}`);
    });
    
    console.log('\n=== Summary ===');
    console.log(`Total nodes: ${graph.nodes.length}`);
    console.log(`Total edges: ${graph.edges.length}`);
    
    // Count function nodes
    let functionCount = 0;
    graph.nodes.forEach(node => {
        if (node.children) {
            functionCount += node.children.length;
        }
    });
    console.log(`Total function nodes: ${functionCount}`);
    
    // Verify HTML imports
    const htmlImportEdges = graph.edges.filter(e => e.from === 'index.html');
    console.log(`\nHTML file has ${htmlImportEdges.length} import edges`);
    
    // Verify CSS imports
    const cssImportEdges = graph.edges.filter(e => e.from === 'styles.css');
    console.log(`CSS file has ${cssImportEdges.length} import edges`);
    
    // Verify function calls
    const functionCallEdges = graph.edges.filter(e => e.type === 'calls');
    console.log(`Found ${functionCallEdges.length} function call edges`);
}

testIntegration().catch(console.error);

// Made with Bob
