/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as sinon from 'sinon';
import { assert } from 'chai';
import os from 'os';
import fs from 'fs';
import stream from 'stream';
import cproc from 'child_process';
import RED from 'node-red';
import { DefaultDeviceIdResolver, DeviceState, DeviceManagerStore, LwM2MDeviceManagement } from '../dist/device-manager';

const PROC_CPUINFO = [
  'processor	: 0\n',
  'model name	: ARMv6-compatible processor rev 7 (v6l)\n',
  'BogoMIPS	: 2.00\n',
  'Features	: half thumb fastmult vfp edsp java tls \n',
  'CPU implementer	: 0x41\n',
  'CPU architecture: 7\n',
  'CPU variant	: 0x0\n',
  'CPU part	: 0xb76\n',
  'CPU revision	: 7\n',
  'Hardware	: BCM2708\n',
  'Revision	: 0010\n',
  'Serial		: 00000000ffff9999\n',
  null
];

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('DeviceIdResolver', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should resolve the unique device identifier', done => {
    let resolver = new DefaultDeviceIdResolver();
    resolver.resolve().then(id => {
      console.log(`id = [${id}]`);
      assert.isDefined(id);
      assert.isNotNull(id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the cpuinfo serial if the device model is RPi', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox.stub(fs, 'stat')
      .onFirstCall().yields()
      .onSecondCall().yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox.stub(fs, 'createReadStream').onFirstCall().returns(readStream);
    sandbox.stub(fs, 'readFileSync').onFirstCall().returns('Raspberry Pi 3 Model B Rev 1.2');
    resolver.resolve().then(id => {
      assert.equal('RPi:00000000ffff9999', id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the cpuinfo serial if the device model is ATB', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox.stub(fs, 'stat')
      .onFirstCall().yields()
      .onSecondCall().yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox.stub(fs, 'createReadStream').onFirstCall().returns(readStream);
    sandbox.stub(fs, 'readFileSync').onFirstCall().returns('Tinker Board\n\0\0\0\0\0');
    resolver.resolve().then(id => {
      assert.equal('ATB:00000000ffff9999', id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the cpuinfo serial if the device model is a generic Linux', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox.stub(fs, 'stat')
      .onFirstCall().yields()
      .onSecondCall().yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox.stub(fs, 'createReadStream').onFirstCall().returns(readStream);
    sandbox.stub(fs, 'readFileSync').onFirstCall().returns('Generic Linux\n\0\0\0\0\0');
    resolver.resolve().then(id => {
      assert.equal('DEV:00000000ffff9999', id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the MAC address', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox.stub(fs, 'stat').onFirstCall().yields(new Error())
      .onSecondCall().yields()
      .onCall(4).yields();
    sandbox.stub(os, 'networkInterfaces').returns({
      'en0' : [
        { mac: '00:00:00:00:00:00' },
        { mac: 'AA:bb:cc:dd:ee:FF' },
      ]
    });
    resolver.resolve().then(id => {
      assert.equal('MAC:en0:aa-bb-cc-dd-ee-ff', id);
      done();
    }).catch(err => {
      done(err);
    });
  });
});

describe('DeviceState', () => {
  let sandbox;
  let state;
  beforeEach(() => {
    state = new DeviceState(() => {}, () => {});
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#testIfCANDYBoardServiceInstalled("candy-pi-lite")', () => {
    it('should return whether or not CANDY Pi Lite board is installed', done => {
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(version => {
        console.log(`installed version? => [${version}]`);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(result => {
        assert.deepEqual(['my:deviceId'], result);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version as systemctl is-enabled ltepi2 fails', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(1);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(result => {
        assert.deepEqual(['my:deviceId'], result);
        assert.isTrue(systemctl.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#initWithFlowFilePath()', () => {
    it('should successfully init DeviceState object', done => {
      state.initWithFlowFilePath(__dirname + '/test-flow.json').then(() => {
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});

describe('DeviceManagerStore', () => {
  let sandbox, store;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    store = new DeviceManagerStore();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('LwM2MDeviceManagement', () => {
    let sandbox;
    let lwm2mdm;
    let state;
    let restart;
    beforeEach(() => {
      state = new DeviceState(() => {}, () => {});
      lwm2mdm = new LwM2MDeviceManagement(state);
      sandbox = sinon.createSandbox();
      restart = LwM2MDeviceManagement.restart;
      LwM2MDeviceManagement.restart = () => {};
    });
    afterEach(() => {
      delete process.env.DEVICE_MANAGEMENT_ENABLED;
      sandbox.restore();
      LwM2MDeviceManagement.restart = restart;
    });

    describe('#init', () => {
      it('should define an event handler which does nothing when deviceState.candyBoardServiceSupported is false', (done) => {
        state.candyBoardServiceSupported = false;

        sandbox.stub(fs, 'readFile')
          .onFirstCall().yields(null, '[]');
        sandbox.stub(fs, 'unlinkSync')
          .onFirstCall().returns();

        let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
        stubEvent.on.onFirstCall().yields({
          clientName: 'my-clientName'
        });
        lwm2mdm.init({
          deviceId: 'deviceId'
        });
        setTimeout(() => {
          try {
            assert.isFalse(stubEvent.emit.withArgs('clientNameResolved', `urn:imei:861000000000000`).called);
            assert.equal(0, Object.keys(lwm2mdm.objects).length);
            done();
          } catch (err) {
            done(err);
          }
        }, 10);
      });

      it('should define an event handler which resolve a device id when process.env.DEVICE_MANAGEMENT_ENABLED is "true"', (done) => {
        state.candyBoardServiceSupported = true;
        state.flowFilePath = `${__dirname}/test-flow.json`;
        process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
        let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
        stubEvent.on.onFirstCall().yields({
          clientName: 'my-clientName'
        });

        sandbox.stub(fs, 'readFile')
          .onFirstCall().yields(null, '[{"type":"tab","label":"CANDY LINE DM"}]')
          .onSecondCall().yields('error!');
        sandbox.stub(fs, 'readFileSync')
          .onFirstCall().returns('[]')
          .onSecondCall().returns('[]');
        sandbox.stub(fs, 'readdir')
          .yields(null, ['test.json']);

        let stubCproc = sandbox.stub(cproc);
        let stdout = sandbox.stub({
          on: () => {}
        });
        stdout.on.onFirstCall().yields('\x1B[94m{ "counter": { "rx": "0", "tx": "0" }, "datetime": "80/01/06,00:55:11", "functionality": "Full", "imei": "861000000000000", "timezone": 9.0, "model": "UC20", "revision": "UC20GQBR03A14E1G", "manufacturer": "Quectel" }\x1B[0m');
        let candy = sandbox.stub({
          stdout: stdout,
          on: () => {}
        });
        stubCproc.spawn.onFirstCall().returns(candy);
        candy.on.onFirstCall().yields(0);

        lwm2mdm.init({
          deviceId: 'deviceId',
          userDir: '/opt/candy-line'
        });
        setTimeout(() => {
          try {
            assert.isTrue(candy.on.called);
            assert.isTrue(stubEvent.emit.withArgs('configurationDone', sinon.match({
              clientName: 'urn:imei:861000000000000',
              clientPort: 57830,
              reconnectSec: 60,
              enableDTLS: false,
              requestBootstrap: true,
              saveProvisionedConfig: true,
              useIPv4: true,
              hideSensitiveInfo: false,
              credentialFilePath: '/opt/candy-line/lwm2m_dm_cred.json'
            })).called);
            assert.isTrue(Object.keys(lwm2mdm.objects).length === 0); // as fake empty array loaded
            done();
          } catch (err) {
            done(err);
          }
        }, 10);
      });

      it('should define an event handler which resolve a device id when a modem info file exists', (done) => {
        state.candyBoardServiceSupported = true;
        state.flowFilePath = `${__dirname}/test-flow.json`;
        process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
        let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
        stubEvent.on.onFirstCall().yields({
          clientName: 'my-clientName'
        });

        sandbox.stub(fs, 'readFile')
          .onFirstCall().yields(null, '[{"type":"tab","label":"CANDY LINE DM"}]')
          .onSecondCall().yields(null, '{"status":"OK","result":{ "counter": { "rx": "0", "tx": "0" }, "datetime": "80/01/06,00:55:11", "functionality": "Full", "imei": "861000000000000", "timezone": 9.0, "model": "UC20", "revision": "UC20GQBR03A14E1G", "manufacturer": "Quectel" }}');
        sandbox.stub(fs, 'readFileSync')
          .onFirstCall().returns('[]')
          .onSecondCall().returns('[]');
        sandbox.stub(fs, 'readdir')
          .yields(null, ['test.json']);

        lwm2mdm.init({
          deviceId: 'deviceId',
          userDir: '/opt/candy-line'
        }).then(() => {
          setTimeout(() => {
            try {
              assert.isTrue(stubEvent.emit.withArgs('configurationDone', sinon.match({
                clientName: 'urn:imei:861000000000000',
                clientPort: 57830,
                reconnectSec: 60,
                enableDTLS: false,
                requestBootstrap: true,
                saveProvisionedConfig: true,
                useIPv4: true,
                hideSensitiveInfo: false,
                credentialFilePath: '/opt/candy-line/lwm2m_dm_cred.json'
              })).called);
              done();
            } catch (err) {
              done(err);
            }
          }, 10);
        }).catch((err) => {
          done(err);
        });
      });

    });

    describe('#getValue', () => {

      it('should return the loaded MO values', (done) => {
        state.candyBoardServiceSupported = true;
        state.flowFilePath = `${__dirname}/test-flow.json`;
        process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
        lwm2mdm.init({
          deviceId: 'deviceId'
        }).then(() => {
          assert.equal('CANDY LINE', lwm2mdm.getValue(3, 0, 0));
          assert.equal(0, lwm2mdm.getValue(11, 0, 24));
          assert.equal('', lwm2mdm.getValue(30001, 0, 103));
          assert.equal(null, lwm2mdm.getValue(90001, 0, 103));
          done();
        }).catch((err) => {
          done(err);
        });
      });

    });

    describe('#setResource', () => {

      it('should store a resource', (done) => {
        state.candyBoardServiceSupported = true;
        state.flowFilePath = `${__dirname}/test-flow.json`;
        process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
        lwm2mdm.init({
          deviceId: 'deviceId'
        }).then(() => {
          lwm2mdm.setResource(3, 0, 0, { value: 'MY MAN' });
          assert.equal('MY MAN', lwm2mdm.getValue(3, 0, 0)); // ACL is ignored
          lwm2mdm.setResource(11, 0, 24, { value: 9876, type: 6 });
          assert.equal(9876, lwm2mdm.getValue(11, 0, 24));
          lwm2mdm.setResource(30001, 0, 103, { value: '$$$$', type: 4 });
          assert.equal('$$$$', lwm2mdm.getValue(30001, 0, 103));
          lwm2mdm.setResource(90001, 0, 103, { value: true, type: 8 });
          assert.equal(true, lwm2mdm.getValue(90001, 0, 103));
          done();
        }).catch((err) => {
          done(err);
        });
      });

    });

    describe('#_updateMindConnectAgentConfiguration', () => {

      it('should modify the existing mindconnect configuration in the flow file', (done) => {
        state.candyBoardServiceSupported = true;
        state.flowFilePath = `${__dirname}/test-flow.json`;
        process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
        const stubRestart = sandbox.stub(LwM2MDeviceManagement, 'restart');
        stubRestart.onFirstCall().returns();
        lwm2mdm.init({
          deviceId: 'deviceId'
        }).then(() => {
          return state.initWithFlowFilePath(`${__dirname}/test-flow-mindconnect-update.json`);
        }).then(() => {
          lwm2mdm.setResource(30001, 0, 0, { value: 'https://my-endpoint' });
          lwm2mdm.setResource(30001, 0, 1, { value: 'my iat' });
          lwm2mdm.setResource(30001, 0, 2, { value: 2 });
          lwm2mdm.setResource(30001, 0, 3, { value: 'my client id' });
          lwm2mdm.setResource(30001, 0, 4, { value: 'my tenant name' });
          lwm2mdm.setResource(30001, 0, 5, { value: '2019-12-31T09:33:02.000Z' });
          lwm2mdm.setResource(30001, 0, 6, { value: true });
          lwm2mdm.setResource(30001, 0, 7, { value: true });
          lwm2mdm.setResource(30001, 0, 8, { value: true });
          lwm2mdm.setResource(30001, 0, 9, { value: 999 });
          lwm2mdm.setResource(30001, 0, 10, { value: 'my node' });
          return lwm2mdm.getValue(30001, 0, 100, `${__dirname}/test-flow-mindconnect.json`); // updateMindConnectAgentConfiguration
        }).then(() => {
          done();
        }).catch((err) => {
          done(err);
        });
      });

    });

  });

});
