//
// Copyright 2020 DXOS.org
//

import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { getProfileName } from '@dxos/cli-core';

export const STORAGE_ROOT = '.wire/storage';
export const CLI_DEFAULT_PERSISTENT = true;

export const getProfileAndStorage = (storagePath, profilePath) => {
  const profileName = getProfileName(profilePath);
  if (!storagePath) {
    storagePath = path.join(os.homedir(), STORAGE_ROOT, profileName);
  }
  fs.ensureDirSync(storagePath);
  return { storagePath, profileName };
};

export const resetStorageForProfile = (storagePath, profilePath) => {
  if (!storagePath) {
    storagePath = path.join(os.homedir(), STORAGE_ROOT, getProfileName(profilePath));
  }
  fs.emptyDirSync(storagePath);
};

export const resetStorage = () => {
  fs.emptyDirSync(path.join(os.homedir(), STORAGE_ROOT));
};
