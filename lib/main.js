'use babel';

import * as helpers from 'atom-linter';
import { extname } from 'path';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { CompositeDisposable } from 'atom';

export default {
  activate() {
    require('atom-package-deps').install('linter-analist');

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('linter-analist.command', (value) => {
        this.executablePath = value;
      }),
      atom.config.observe('linter-analist.ignoredExtensions', (value) => {
        this.ignoredExtensions = value;
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  provideLinter() {
    const regex = /.+:(\d+)\s*(.+?)[,:]\s(.+)/g;
    return {
      name: 'Analist',
      grammarScopes: ['source.ruby', 'source.ruby.rails', 'source.ruby.rspec'],
      scope: 'file',
      lintOnFly: true,
      lint: async (textEditor) => {
        const filePath = textEditor.getPath();
        if (!filePath) {
          // We somehow got called without a file path
          return null;
        }
        const fileText = textEditor.getText();
        const fileExtension = extname(filePath).substr(1);

        if (this.ignoredExtensions.includes(fileExtension)) {
          return [];
        }

        const execArgs = [
          `--stdin=${filePath}`,
        ];

        const execOpts = {
          stdin: fileText,
          stream: 'stderr',
          allowEmptyStderr: true,
        };

        const output = await helpers.exec(this.executablePath, execArgs, execOpts);
        if (textEditor.getText() !== fileText) {
          // File contents have changed, just tell Linter not to update messages
          return null;
        }
        const toReturn = [];
        let match = regex.exec(output);
        while (match !== null) {
          const msgLine = Number.parseInt(match[1] - 1, 10);
          const type = match[2].indexOf('Error') > -1 ? 'Error' : 'Warning';
          toReturn.push({
            range: helpers.generateRange(textEditor, msgLine),
            type,
            text: match[3],
            filePath,
          });
          match = regex.exec(output);
        }
        return toReturn;
      },
    };
  },
};