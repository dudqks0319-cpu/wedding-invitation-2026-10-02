// Sites static preview uses the existing single-file browser build.
// Next Route Handlers remain in source and require a separately configured server runtime.
import {mkdir, copyFile} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await copyFile('dist-preview/index.html', 'dist/index.html');
console.log('Sites preview ready: dist/index.html (device-local data mode).');
