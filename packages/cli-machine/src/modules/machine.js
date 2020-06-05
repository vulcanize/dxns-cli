//
// Copyright 2020 Wireline, Inc.
//

// TODO(dboreham):
//   Move meat into handlers dir
//   Figure out how to log from a cli program

import assert from 'assert';
import crypto from 'crypto';

import DigitalOcean from 'do-wrapper';

import { asyncHandler, print } from '@dxos/cli-core';
import { Registry } from '@wirelineio/registry-client';

const XBOX_TYPE = 'wrn:xbox';

/**
 *
 * @param {DigitalOceanSession} session
 * @param {string} name
 * @return {string} - id for box named name
 */
const getIdFromName = async (session, name) => {
  assert(session);
  assert(name);
  const result = await session.droplets.getAll();
  const targetDroplet = result.droplets.filter((droplet) => { return droplet.name === name; });
  return targetDroplet[0].id;
};

/**
 * Machine CLI module.
 */
export const MachineModule = ({ config }) => {
  const doAccessToken = config.get('services.machine.doAccessToken');
  const githubAccessToken = config.get('services.machine.githubAccessToken');
  const dnsDomain = config.get('services.machine.dnsDomain');
  // TODO(dboreham): Get from profile
  const sshKeys = ['ec:e0:6b:82:1e:b2:b7:74:a2:c3:1b:b4:3c:6d:72:a0', 'b1:a9:fa:63:0d:60:d5:6c:31:76:37:52:c7:fe:02:0b'];

  return ({
    command: ['machine'],
    describe: 'Machine CLI.',
    builder: yargs => yargs

      .command({
        command: ['list'],
        describe: 'List Machines.',
        builder: yargs => yargs,

        handler: asyncHandler(async () => {
          const { verbose } = yargs.argv;

          const session = new DigitalOcean(doAccessToken);
          const result = await session.droplets.getAll();

          if (verbose) {
            print({ result }, { json: true });
          }

          const boxesRaw = result.droplets.filter((droplet) => { return droplet.name.startsWith('box'); });
          const machines = boxesRaw.map((droplet) => {
            return { name: droplet.name, created_at: droplet.created_at };
          });

          print({ machines }, { json: true });
        })
      })
      .command({
        command: ['publish'],
        describe: 'Publish a machine.',
        builder: yargs => yargs
          .option('name', { type: 'string' }),

        handler: asyncHandler(async () => {
          const { verbose } = yargs.argv;

          const boxName = yargs.argv.name;
          const fullyQualifiedBoxName = `${boxName}.${dnsDomain}`;
          const wnsBoxName = `${dnsDomain}/${boxName}`;

          const session = new DigitalOcean(doAccessToken);

          const dropletId = await getIdFromName(session, yargs.argv.name);

          const dropletInfo = await session.droplets.getById(dropletId);

          const ipAddress = dropletInfo.droplet.networks.v4[0].ip_address;

          const dnsResult = await session.domains.createRecord(dnsDomain,
            { type: 'A', name: boxName, data: ipAddress });

          if (verbose) {
            print({ dnsResult }, { json: true });
          }

          const { server, userKey, bondId, chainId } = config.get('services.wns');
          const registry = new Registry(server, chainId);

          const version = '1.0.0';

          const boxRecord = {
            type: XBOX_TYPE,
            name: wnsBoxName,
            version
          };

          await registry.setRecord(userKey, boxRecord, undefined, bondId);

          const machineData = {
            name: boxName,
            dns_name: fullyQualifiedBoxName,
            wrn: wnsBoxName
          };

          print({ machine_data: machineData }, { json: true });
        })
      })
      .command({
        command: ['info'],
        describe: 'Info about a Machine.',
        builder: yargs => yargs
          .option('name', { type: 'string' }),

        handler: asyncHandler(async () => {
          const session = new DigitalOcean(doAccessToken);

          const dropletId = await getIdFromName(session, yargs.argv.name);

          const { droplet: dropletInfo } = await session.droplets.getById(dropletId);

          const box = {
            name: dropletInfo.name,
            ip_address: dropletInfo.networks.v4[0].ip_address
          };

          print({ box }, { json: true });
        })
      })
      .command({
        command: ['create'],
        describe: 'Create a Machine.',
        builder: yargs => yargs
          .option('name', { type: 'string' }),

        handler: asyncHandler(async () => {
          const { verbose } = yargs.argv;

          const session = new DigitalOcean(doAccessToken);

          const boxName = yargs.argv.name ? yargs.argv.name : `box${crypto.randomBytes(4).toString('hex')}`;
          const boxFullyQualifiedName = `${boxName}.${dnsDomain}`;

          // TODO(dboreham): There are custom cloud-init sections for things like configuring repos and installing packages that we should use.
          const cloudConfigScript =
         `#cloud-config
         
         runcmd:
           - add-apt-repository -y ppa:longsleep/golang-backports
           - apt-get install -y psmisc git wget curl gnupg python build-essential golang-1.13
           - ln -s /usr/lib/go-1.13/bin/go /usr/local/bin
           - ln -s /usr/lib/go-1.13/bin/gofmt /usr/local/bin
           - add-apt-repository -y ppa:certbot/certbot
           - apt install -y python-certbot-apache
           - git clone https://${githubAccessToken}@github.com/dxos/xbox.git
           - cd xbox
           - sed -i 's?git@github.com:wirelineio/wns.git?https://${githubAccessToken}@github.com/wirelineio/wns.git?g' .gitmodules
           - git submodule sync
           - git submodule update --init --recursive
           - cd ..
           - cp -r xbox /opt
           - cd /opt/xbox/scripts
           - sed -i 's/run_installer "ssh" install_ssh_key/#run_installer "ssh" install_ssh_key/g' install.sh
           - sed -i 's/apt clean//g' install.sh
           - sed -i 's/apt autoclean//g' install.sh
           - sed -i 's/apt autoremove//g' install.sh
           - export HOME=/root
           - ./install.sh /opt
           - sed -i s/xbox.local/${boxFullyQualifiedName}/g /root/.wire/remote.yml
           - cp ./conf/systemd/xbox.service /etc/systemd/system
           - systemctl enable xbox
           - systemctl start xbox
        `;

          const createParameters = {
            name: boxName,
            region: 'nyc3',
            size: 's-2vcpu-4gb',
            image: 'ubuntu-18-04-x64',
            ssh_keys: sshKeys,
            user_data: cloudConfigScript
          };

          if (verbose) {
            print({ createParameters }, { json: true });
          }

          const result = await session.droplets.create(createParameters);

          if (verbose) {
            print({ result }, { json: true });
          }

          const machine = {
            name: boxName
          };

          print({ machine }, { json: true });
        })
      })
  });
};