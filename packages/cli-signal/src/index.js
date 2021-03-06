//
// Copyright 2020 DXOS.org
//

import { createCLI } from '@dxos/cli-core';

import { SignalModule } from './modules/signal';

import info from '../extension.yml';

module.exports = createCLI({
  modules: [SignalModule],
  dir: __dirname,
  main: !module.parent,
  info
});
