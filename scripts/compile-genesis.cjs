const fs = require('node:fs');

const crypto = require('node:crypto');
const solc = require('solc');
for (const [contractName, slug] of [['GenesisToken', 'genesis-token'], ['GenesisSale', 'genesis-sale']]) {
const fileName = contractName + '.sol';
const sources = {[fileName]: {content: fs.readFileSync('contracts/'+fileName,'utf8').replace(/\r\n/g,'\n')}};
const settings = {optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}};
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import:p=>{
  if(!p.startsWith('@openzeppelin/contracts/')||p.includes('..'))return {error:'Unexpected import'};
  return {contents:fs.readFileSync(require.resolve(p),'utf8')};
}}));
const errors=(output.errors||[]).filter(e=>e.severity==='error');
if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
const c=output.contracts[fileName][contractName];
const artifact={contractName,compiler:solc.version(),openzeppelin:require('@openzeppelin/contracts/package.json').version,evmVersion:'paris',optimizerRuns:200,sourceSha256:crypto.createHash('sha256').update(sources[fileName].content).digest('hex'),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};
fs.mkdirSync('src/generated',{recursive:true});fs.writeFileSync('src/generated/'+slug+'.json',JSON.stringify(artifact,null,2)+'\n');
// Full compiler input makes independent source verification reproducible.
const inputSources={...sources};
for(const file of Object.keys(output.sources)){if(!inputSources[file])inputSources[file]={content:fs.readFileSync(require.resolve(file),'utf8')};}
fs.writeFileSync('public/downloads/'+slug+'-source.json',JSON.stringify({language:'Solidity',sources:inputSources,settings},null,2)+'\n');
console.log(`Compiled GenesisToken: ${artifact.compiler}; OpenZeppelin ${artifact.openzeppelin}`);
}
