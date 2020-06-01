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

function payForOrder(consumer, payment) {
    return api.transact({
        actions: [{
            account: 'eosio.token', // contract
            name: 'transfer', // action
            authorization: [{
                actor: consumer,
                permission: 'active',
            }],
            data: {
                from: consumer,
                to: 'fabblink3hub',
                quantity: payment,
                memo: '',
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function placeOrderOnDesign(consumer, vendor, order, design, quantity) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'placeorder', // action
            authorization: [{
                actor: consumer,
                permission: 'active',
            }],
            data: {
                consumer: consumer,
                vendor: vendor,
                order: order, // order name for vendor
                design: design,
                quantity: quantity,
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function printOrder(vendor, order) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'printorder', // action
            authorization: [{
                actor: vendor,
                permission: 'active',
            }],
            data: {
                vendor: vendor,
                order: order, // order name for vendor
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function confirmOrder(consumer, vendor, order) {
    return api.transact({
        actions: [{
            account: 'fabblink3hub', // contract
            name: 'confirmorder', // action
            authorization: [{
                actor: consumer,
                permission: 'active',
            }],
            data: {
                consumer: consumer,
                vendor: vendor,
                order: order, // order name for vendor
            },
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

function showBalance(account) {
    return rpc.get_currency_balance('eosio.token', account, 'EOS');
}

function showOrders(vendor) {
    return rpc.get_table_rows({
        json: true,
        code: 'fabblink3hub',
        scope: vendor,
        table: 'order',
        limit: -1,
    });
}

async function run() {
    // Web Site side
    console.log('register designer:', await registerDesigner('fabblinkdesg'));
    console.log('register design:', await registerDesign('fabblinkdesg','cf1d362ea4d5e32fb54430e8cf44c113b1bbf86079dcba10ad67df3414ce06e6', '10.0000 EOS', '1.0000 EOS'));
    console.log('register vendor: ', await registerVendor('fabblinkvend'));
    console.log('balance of the contract before pay: ', await showBalance('fabblink3hub'));
    console.log('balance of the consumer before pay: ', await showBalance('fabblinkcons'));
    console.log('consumer pay for order: ', await payForOrder('fabblinkcons', '33.0000 EOS'));
    console.log('balance of the contract after pay: ', await showBalance('fabblink3hub'));
    console.log('balance of the consumer after pay: ', await showBalance('fabblinkcons'));
    console.log('consumer place order: ', await placeOrderOnDesign('fabblinkcons', 'fabblinkvend', 'order1', 'cf1d362ea4d5e32fb54430e8cf44c113b1bbf86079dcba10ad67df3414ce06e6', 3));
    console.log('checking that vendor has order: ', await showOrders('fabblinkvend'));

    // Printer side
    for (i = 0; i < 3; ++i) {
        console.log('vendor print design: ', await printOrder('fabblinkvend', 'order1'));
    }

    // WebSite side
    console.log('balance of the vendor before confirmation: ', await showBalance('fabblinkvend'));
    console.log('balance of the designer before confirmation: ', await showBalance('fabblinkdesg'));

    console.log('consumer confirm order: ', await confirmOrder('fabblinkcons', 'fabblinkvend', 'order1'));

    console.log('balance of the vendor after confirmation: ', await showBalance('fabblinkvend'));
    console.log('balance of the designer after confirmation: ', await showBalance('fabblinkdesg'));
}

run();
