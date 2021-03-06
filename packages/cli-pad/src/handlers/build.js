//
// Copyright 2020 DXOS.org
//

import { spawnSync } from 'child_process';
import semverInc from 'semver/functions/inc';
import { log } from '@dxos/debug';

import { readFile } from '@dxos/cli-core';

import { PAD_CONFIG_FILENAME } from '../config';

const DEFAULT_BUILD = 'yarn dist';

export const build = (config, { getPadRecord }) => async ({ verbose }) => {
  const appConfig = await readFile(PAD_CONFIG_FILENAME);

  const {
    build = DEFAULT_BUILD
  } = appConfig;

  const record = getPadRecord(appConfig);
  record.version = semverInc(appConfig.version, 'patch');

  log(`Building ${record.name}...`);
  const [command, ...args] = build.split(' ');

  // build with configuration
  const { status } = spawnSync(command, args, {
    env: {
      ...process.env,
      CONFIG_DYNAMIC: true
    },
    stdio: verbose && 'inherit'
  });

  if (status) {
    log('Build failed.');
    process.exit(status);
  }

  log('Build Ok.');
};
