import {defineConfig} from 'vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
 build:{outDir:path.join(root,'build'),emptyOutDir:true,lib:{entry:path.join(root,'application.ts'),formats:['es'],fileName:()=> 'replacement.mjs'},minify:false},
});
