const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');

const defaultPrivateKey = "5JME42gdUnjG8bMGjFaVcGgaEfnRtxjs2mfHAWnE96i859u69kz";
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('http://jungle.atticlab.net:8888', { fetch })
const { TextEncoder, TextDecoder } = require('util');

const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

function registerVendor (name) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'regvendor', // action
            authorization: [{
                actor: name,
                permission: 'active',
            }],
            data: {
                vendor: name,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function showVendors() {
    return rpc.get_table_by_scope({
        json: true,
        code: 'fabblink3hub',
        table: 'vendor',
        limit: -1,
    });
}

function unregisterVendor (name) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'unregvendor', // action
            authorization: [{
                actor: name,
                permission: 'active',
            }],
            data: {
                vendor: name,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

async function reg() {
    console.log('register vendor: ', await registerVendor('fabblinkvend'));
    console.log('table with vendors: ', await showVendors());
}

async function unreg() {
    console.log('unregister vendor: ', await unregisterVendor('fabblinkvend'));
}

unreg();
