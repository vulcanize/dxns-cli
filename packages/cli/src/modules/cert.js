//
// Copyright 2020 Wireline, Inc.
//

import assert from 'assert';

import { asyncHandler, importCert } from '@dxos/cli-core';

/**
 * Cert CLI module.
 * @returns {object}
 */
export const CertModule = ({ config }) => ({
  command: ['cert'],
  describe: 'Certificates.',

  builder: yargs => yargs

    // Import.
    .command({
      command: ['import'],
      describe: 'Import certificate.',
      builder: yargs => yargs
        .option('url', { default: config.get('system.certEndpoint') }),

      handler: asyncHandler(async argv => {
        const { url } = argv;

        assert(url, 'Invalid Cert URL.');
        await importCert(url);
      })
    })
});
