import path from 'path';
import {readdirSync, readFileSync} from 'node:fs';
import {babel} from '@rollup/plugin-babel';
import analyze from 'rollup-plugin-analyzer';

export default [
  {
    input: ['src/js/index.mjs', 'src/js/plugin.mjs'],
    output: {
      sourcemap: false,
      format: 'esm',
      dir: 'dist',
      preserveModules: true,
      preserveModulesRoot: 'src/js',
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name]-[hash].mjs',
    },
    plugins: [
      {
        name: 'flow-definitions',
        generateBundle() {
          const root = path.resolve('src/js');
          for (const file of readdirSync(root, {recursive: true})) {
            if (!file.endsWith('.mjs')) continue;
            const filename = path.join(root, file);
            this.addWatchFile(filename);
            const source = readFileSync(filename, 'utf8');
            this.emitFile({type: 'asset', fileName: `${file.split(path.sep).join('/')}.flow`, source});
          }
        },
      },
      babel({
        babelHelpers: 'bundled',
      }),
      analyze(),
    ],
    watch: {
      clearScreen: false,
      include: ['src/**'],
    },
  },
];
