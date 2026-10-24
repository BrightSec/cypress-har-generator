import externals from 'webpack-node-externals';
import FileManagerPlugin from 'filemanager-webpack-plugin';
import webpack, { type Configuration } from 'webpack';
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
        commonjsMagicComments: true
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
  experiments: { outputModule: true },
  plugins: [
    // `Loader` loads user files with `require` so that the loaders registered by Cypress (e.g. for TypeScript) apply
    new webpack.BannerPlugin({
      raw: true,
      test: /index\.mjs$/,
      banner:
        "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);"
    }),
    new FileManagerPlugin({
      events: {
        onEnd: [moveCommands('mjs')]
      }
    })
  ],
  output: {
    ...base('mjs').output,
    module: true,
    chunkFormat: 'module',
    library: { type: 'module' }
  }
};

export default [commonjs, esm];
