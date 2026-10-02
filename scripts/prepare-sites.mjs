import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
const html=await readFile(`${manifest.static.directory}/index.html`,'utf8');
if(!html.includes('https://osamosam-app.jyb1126.chatgpt.site'))throw new Error('Canonical service link missing');
for(const hash of ['#/templates/blossom','#//invalid.example']){
 let result;runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,location:{hash,pathname:'/',search:'',replace:value=>{result=value;}}});
 if(new URL(result).origin!=='https://osamosam-app.jyb1126.chatgpt.site')throw new Error('Unsafe redirect');
 if(hash==='#/templates/blossom'&&!result.endsWith('/templates/blossom'))throw new Error('Old template path lost');
}
console.log('Sites entry ready; the existing service provides the Cloudflare backend.');
