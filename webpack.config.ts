import externals from 'webpack-node-externals';
import FileManagerPlugin from 'filemanager-webpack-plugin';
import type { Configuration } from 'webpack';
import { resolve } from 'node:path';

const base = (extension: 'js' | 'mjs'): Configuration => ({
  context: process.cwd(),
  entry: {
    commands: resolve('src/commands.ts'),
    index: resolve('src/index.ts')
  },
  devtool: 'source-map',
  mode: 'production',
  target: 'node',
  resolve: {
    extensions: ['.ts']
  },
  module: {
    parser: {
      javascript: {
        // `Loader` calls `require` at runtime for user files, which must not be bundled
        createRequire: false
      }
    },
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: resolve('./tsconfig.build.json'),
              compilerOptions: { declaration: extension === 'js' }
            }
          }
        ]
      }
    ]
  },
  output: {
    path: resolve('./dist'),
    filename: `[name].${extension}`
  }
});

const moveCommands = (extension: 'js' | 'mjs') => ({
  move: [
    {
      source: `./dist/commands.${extension}`,
      destination: `./commands.${extension}`
    },
    {
      source: `./dist/commands.${extension}.map`,
      destination: `./commands.${extension}.map`
    }
  ]
});

const commonjs: Configuration = {
  ...base('js'),
  name: 'commonjs',
  externals: externals(),
  plugins: [
    new FileManagerPlugin({
      events: {
        onStart: [
          {
            delete: [
              './dist',
              './commands.js',
              './commands.js.map',
              './commands.mjs',
              './commands.mjs.map'
            ]
          }
        ],
        onEnd: [moveCommands('js')]
      }
    })
  ],
  output: {
    ...base('js').output,
    library: { type: 'commonjs' }
  }
};

const esm: Configuration = {
  ...base('mjs'),
  name: 'esm',
  // the CommonJS build cleans the output folder, so it must finish first
  dependencies: ['commonjs'],
  externals: externals({ importType: name => `module ${name}` }),
  plugins: [
    {
      // the import condition needs ES module types, which share the declarations of the CommonJS build
      apply: compiler =>
        compiler.hooks.thisCompilation.tap('EsmTypes', compilation =>
          compilation.hooks.processAssets.tap('EsmTypes', () =>
            compilation.emitAsset(
              'index.d.mts',
              new compiler.webpack.sources.RawSource(
                "export * from './index.js';\n"
              )
            )
          )
        )
    },
    new FileManagerPlugin({
      events: {
        onEnd: [moveCommands('mjs')]
      }
    })
  ],
  output: {
    ...base('mjs').output,
    module: true,
    library: { type: 'module' }
  }
};

export default [commonjs, esm];
