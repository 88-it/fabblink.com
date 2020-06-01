const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');

const defaultPrivateKey = "5JME42gdUnjG8bMGjFaVcGgaEfnRtxjs2mfHAWnE96i859u69kz";
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('http://jungle.atticlab.net:8888', { fetch })
const { TextEncoder, TextDecoder } = require('util');

const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

function registerDesigner (name) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'regdesignr', // action
            authorization: [{
                actor: name,
                permission: 'active',
            }],
            data: {
                designer: name,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function registerDesign(designer, design, price, fee) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'regdesign', // action
            authorization: [{
                actor: designer,
                permission: 'active',
            }],
            data: {
                designer: designer,
                design: design,
                price: price,
                fee: fee
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function unregisterDesigner(name) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'unregdesignr', // action
            authorization: [{
                actor: name,
                permission: 'active',
            }],
            data: {
                designer: name,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function unregisterDesign(designer, design) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'unregdesign', // action
            authorization: [{
                actor: designer,
                permission: 'active',
            }],
            data: {
                designer: designer,
                design: design,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function showDesigners() {
    return rpc.get_table_by_scope({
        json: true,
        code: 'fabblink3hub',
        table: 'designer',
        limit: -1,
    });
}

function showDesigns() {
    return rpc.get_table_rows({
        json: true,
        code: 'fabblink3hub',
        scope: 'fabblink3hub',
        table: 'design',
        limit: -1,
    });
}

async function reg() {
    console.log('register designer:', await registerDesigner('fabblinkdesg'));
    console.log('table with designers: ', await showDesigners());

    console.log('register design:', await registerDesign('fabblinkdesg','cf1d362ea4d5e32fb54430e8cf44c113b1bbf86079dcba10ad67df3414ce06e6', '10.0000 EOS', '1.0000 EOS'));
    console.log('table with designs:', await showDesigns());
}

async function unreg() {
    console.log('unregister design:', await unregisterDesign('fabblinkdesg','cf1d362ea4d5e32fb54430e8cf44c113b1bbf86079dcba10ad67df3414ce06e6'));
    console.log('unregister designer: ', await unregisterDesigner('fabblinkdesg'));
}

unreg();
