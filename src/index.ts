import { generate } from './generator';
import { type CliPlugin } from '@zenstackhq/sdk';

const plugin: CliPlugin = {
  generate,
  name: 'Documentation Generator',
  statusText: 'Generating documentation',
};

export default plugin;
