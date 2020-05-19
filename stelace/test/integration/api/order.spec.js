require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const _ = require('lodash')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const { getObjectEvent, testEventMetadata } = require('../../util')

test.before(async (t) => {
  await before({ name: 'order' })(t)
  await beforeEach()(t) // concurrent tests are much faster (~10 times here)
})
// test.beforeEach(beforeEach())
test.after(after())

test('previews an order with reference to transactions', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:preview:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_RjhfQps1I3a1gJYz2I3a']
    })
    .expect(200)

  t.falsy(order.id)
  t.true(order.lines.length > 0)

  order.lines.forEach(line => {
    t.true(['trn_a3BfQps1I3a1gJYz2I3a', 'trn_RjhfQps1I3a1gJYz2I3a'].includes(line.transactionId))
  })

  const { body: order2 } = await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      transactionIds: 'trn_a3BfQps1I3a1gJYz2I3a'
    })
    .expect(200)

  t.falsy(order2.id)
  t.true(order2.lines.length > 0)

  order2.lines.forEach(line => {
    t.is(line.transactionId, 'trn_a3BfQps1I3a1gJYz2I3a')
  })
})

test('cannot preview an order with transactions from different currency or taker', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:preview:all'] })

  await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_VHgfQps1I3a1gJYz2I3a'] // different taker
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_ndKcBks1TV21ggvMqTV2'] // different currency
    })
    .expect(422)

  t.pass()
})

test('previews an order with lines', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:preview:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ]
    })
    .expect(200)

  t.falsy(order.id)
  t.is(order.currency, 'EUR')
  t.is(order.amountDue, 120)
  t.is(order.amountRemaining, 120)
  t.is(order.amountPaid, 0)
  t.true(order.lines.length === 2)

  order.lines.forEach(line => {
    t.falsy(line.id)
    t.falsy(line.createdDate)
    t.falsy(line.updatedDate)
  })
})

test('previews an order with lines and moves', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:preview:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders/preview')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      moves: [
        { senderId: 'user-external-id1', senderAmount: 50, platformAmount: 10, currency: 'EUR' }
      ]
    })
    .expect(200)

  t.falsy(order.id)
  t.is(order.currency, 'EUR')
  t.is(order.amountDue, 120)
  t.is(order.amountRemaining, 70)
  t.is(order.amountPaid, 50)
  t.true(order.lines.length === 2)
  t.true(order.moves.length === 1)

  order.lines.forEach(line => {
    t.falsy(line.id)
    t.falsy(line.createdDate)
    t.falsy(line.updatedDate)
  })

  order.moves.forEach(move => {
    t.falsy(move.id)
    t.falsy(move.createdDate)
    t.falsy(move.updatedDate)
  })
})

test('list orders', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:list:all'] })

  const result = await request(t.context.serverUrl)
    .get('/orders?page=2')
    .set(authorizationHeaders)
    .expect(200)

  const obj = result.body

  t.true(typeof obj === 'object')
  t.true(typeof obj.nbResults === 'number')
  t.true(typeof obj.nbPages === 'number')
  t.true(typeof obj.page === 'number')
  t.true(typeof obj.nbResultsPerPage === 'number')
  t.true(Array.isArray(obj.results))
})

test('list orders with id filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:list:all'] })

  const result = await request(t.context.serverUrl)
    .get('/orders?id=ord_eP0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  const obj = result.body

  t.is(typeof obj, 'object')
  t.is(obj.nbResults, 1)
  t.is(obj.nbPages, 1)
  t.is(obj.page, 1)
  t.is(typeof obj.nbResultsPerPage, 'number')
  t.is(obj.results.length, 1)
})

test('list orders with advanced filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:list:all'] })

  const result1 = await request(t.context.serverUrl)
    .get('/orders?senderId=ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c')
    .set(authorizationHeaders)
    .expect(200)

  const obj1 = result1.body

  obj1.results.forEach(order => {
    t.true(['ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c'].includes(order.senderId))
  })

  const result2 = await request(t.context.serverUrl)
    .get('/orders?receiverId=usr_QVQfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const obj2 = result2.body

  obj2.results.forEach(order => {
    t.true(order.lines.reduce((memo, line) => {
      return memo || line.receiverId === 'usr_QVQfQps1I3a1gJYz2I3a'
    }, false))
  })

  const result3 = await request(t.context.serverUrl)
    .get('/orders?transactionId=trn_Wm1fQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const obj3 = result3.body

  obj3.results.forEach(order => {
    t.true(order.lines.reduce((memo, line) => {
      return memo || line.transactionId === 'trn_Wm1fQps1I3a1gJYz2I3a'
    }, false))
  })
})

test('finds an order', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:read:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .get('/orders/ord_eP0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  t.is(order.id, 'ord_eP0hwes1jwf1gxMLCjwf')
})

test('creates an order with reference to transactions', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'order:create:all',
      'transaction:list:all'
    ]
  })

  const transactionId1 = 'bgk_svEC9Te1UPo1hqo8MUPo'
  const transactionId2 = 'bgk_dRuSeXe15jH1hS7ao5jH'

  const { body: { results: transactions } } = await request(t.context.serverUrl)
    .get(`/transactions?id=${transactionId1},${transactionId2}`)
    .set(authorizationHeaders)
    .expect(200)

  // only use transactions with no fees to check below exact amounts
  const transaction1 = transactions.find(b => b.id === transactionId1)
  const transaction2 = transactions.find(b => b.id === transactionId2)

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      transactionIds: [transactionId1, transactionId2],
      metadata: { dummy: true }
    })
    .expect(200)

  t.truthy(order.id)
  t.is(order.metadata.dummy, true)
  t.true(order.lines.length > 0)

  order.lines.forEach(line => {
    t.false(line.reversal)
    t.true([transactionId1, transactionId2].includes(line.transactionId))
  })

  const groupedOrderLinesByTransaction = _.groupBy(order.lines, 'transactionId')

  const senderLine1 = groupedOrderLinesByTransaction[transactionId1].find(line => line.senderId)
  const receiverLine1 = groupedOrderLinesByTransaction[transactionId1].find(line => line.receiverId)

  // works because asset type has 'day' as time unit
  const receiverAmount1 = transaction1.duration.d * transaction1.unitPrice * transaction1.quantity

  t.true(senderLine1.senderAmount === receiverAmount1)
  t.true(senderLine1.receiverAmount === 0)
  t.true(senderLine1.platformAmount === 0)
  t.is(senderLine1.currency, transaction1.currency)

  t.true(receiverLine1.senderAmount === 0)
  t.true(receiverLine1.receiverAmount === receiverAmount1)
  t.true(receiverLine1.platformAmount === 0)
  t.is(receiverLine1.currency, transaction1.currency)

  const senderLine2 = groupedOrderLinesByTransaction[transactionId2].find(line => line.senderId)
  const receiverLine2 = groupedOrderLinesByTransaction[transactionId2].find(line => line.receiverId)

  // works because asset type has 'day' as time unit
  const receiverAmount2 = transaction2.duration.d * transaction2.unitPrice * transaction2.quantity

  t.true(senderLine2.senderAmount === receiverAmount2)
  t.true(senderLine2.receiverAmount === 0)
  t.true(senderLine2.platformAmount === 0)
  t.is(senderLine2.currency, transaction2.currency)

  t.true(receiverLine2.senderAmount === 0)
  t.true(receiverLine2.receiverAmount === receiverAmount2)
  t.true(receiverLine2.platformAmount === 0)
  t.is(receiverLine2.currency, transaction2.currency)
})

test('cannot create an order with transactions from different currency or taker', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:create:all'] })

  await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_VHgfQps1I3a1gJYz2I3a'], // different taker
      metadata: { dummy: true }
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_ndKcBks1TV21ggvMqTV2'], // different currency
      metadata: { dummy: true }
    })
    .expect(422)

  t.pass()
})

test('creates an order with lines', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:create:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      metadata: { dummy: true }
    })
    .expect(200)

  t.truthy(order.id)
  t.is(order.currency, 'EUR')
  t.is(order.amountDue, 120)
  t.is(order.amountRemaining, 120)
  t.is(order.amountPaid, 0)
  t.is(order.metadata.dummy, true)
  t.true(order.lines.length === 2)

  order.lines.forEach(line => {
    t.truthy(line.id)
    t.truthy(line.createdDate)
    t.truthy(line.updatedDate)
  })
})

test('creates an order with lines and moves', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:create:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      moves: [
        { senderId: 'user-external-id1', senderAmount: 50, platformAmount: 10, currency: 'EUR' }
      ],
      metadata: { dummy: true }
    })
    .expect(200)

  t.truthy(order.id)
  t.is(order.currency, 'EUR')
  t.is(order.amountDue, 120)
  t.is(order.amountRemaining, 70)
  t.is(order.amountPaid, 50)
  t.is(order.metadata.dummy, true)
  t.true(order.lines.length === 2)
  t.true(order.moves.length === 1)

  order.lines.forEach(line => {
    t.truthy(line.id)
    t.truthy(line.createdDate)
    t.truthy(line.updatedDate)
  })

  order.moves.forEach(move => {
    t.truthy(move.id)
    t.truthy(move.createdDate)
    t.truthy(move.updatedDate)
  })
})

test('cannot create an order with mismatch information between lines and moves', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:create:all'] })

  await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      moves: [
        // unknown sender
        { senderId: 'unknown-user', senderAmount: 50, platformAmount: 10, currency: 'EUR' }
      ],
      metadata: { dummy: true }
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' },
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      moves: [
        // currency mismatch
        { senderId: 'user-external-id1', senderAmount: 50, platformAmount: 10, currency: 'USD' }
      ],
      metadata: { dummy: true }
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      lines: [
        { senderId: 'user-external-id1', senderAmount: 120, platformAmount: 20, currency: 'EUR' }
      ],
      moves: [
        // receiver not referenced in lines
        { receiverId: 'user-external-id2', receiverAmount: 100, platformAmount: 10, currency: 'EUR' }
      ],
      metadata: { dummy: true }
    })
    .expect(422)

  t.pass()
})

test('updates an order', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['order:edit:all'] })

  const { body: order } = await request(t.context.serverUrl)
    .patch('/orders/ord_eP0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .send({
      metadata: { dummy: true }
    })
    .expect(200)

  t.is(order.id, 'ord_eP0hwes1jwf1gxMLCjwf')
  t.is(order.metadata.dummy, true)
})

// ORDER LINE

test('finds an order line', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['orderLine:read:all'] })

  const { body: orderLine } = await request(t.context.serverUrl)
    .get('/order_lines/ordl_KdA9vs1st51h6q3wst5')
    .set(authorizationHeaders)
    .expect(200)

  t.is(orderLine.id, 'ordl_KdA9vs1st51h6q3wst5')
})

test('creates an order line', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'order:read:all',
      'orderLine:create:all'
    ]
  })

  const { body: beforeOrder } = await request(t.context.serverUrl)
    .get('/orders/ord_ax0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  const { body: orderLine } = await request(t.context.serverUrl)
    .post('/order_lines')
    .set(authorizationHeaders)
    .send({
      orderId: 'ord_ax0hwes1jwf1gxMLCjwf',
      transactionId: 'trn_a3BfQps1I3a1gJYz2I3a',
      senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      senderAmount: 10,
      currency: 'EUR'
    })
    .expect(200)

  t.is(orderLine.transactionId, 'trn_a3BfQps1I3a1gJYz2I3a')
  t.is(orderLine.senderId, 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c')
  t.is(orderLine.senderAmount, 10)

  const { body: afterOrder } = await request(t.context.serverUrl)
    .get('/orders/ord_ax0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  t.is(beforeOrder.amountDue + orderLine.senderAmount, afterOrder.amountDue)
})

test('cannot create an order line if payment is attempted except if it is reversal', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['orderLine:create:all'] })

  await request(t.context.serverUrl)
    .post('/order_lines')
    .set(authorizationHeaders)
    .send({
      orderId: 'ord_om2DV3s1R5E1geUuCR5E',
      transactionId: 'trn_Wm1fQps1I3a1gJYz2I3a',
      senderId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      senderAmount: 10,
      currency: 'USD'
    })
    .expect(422)

  const { body: orderLine } = await request(t.context.serverUrl)
    .post('/order_lines')
    .set(authorizationHeaders)
    .send({
      orderId: 'ord_om2DV3s1R5E1geUuCR5E',
      transactionId: 'trn_Wm1fQps1I3a1gJYz2I3a',
      senderId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      senderAmount: -10,
      currency: 'USD',
      reversal: true
    })
    .expect(200)

  t.is(orderLine.reversal, true)
  t.is(orderLine.senderId, 'usr_Y0tfQps1I3a1gJYz2I3a')
  t.is(orderLine.transactionId, 'trn_Wm1fQps1I3a1gJYz2I3a')
})

test('updates an order line', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['orderLine:edit:all'] })

  const { body: orderLine } = await request(t.context.serverUrl)
    .patch('/order_lines/ordl_KdA9vs1st51h6q3wst5')
    .set(authorizationHeaders)
    .send({
      metadata: { test: true }
    })
    .expect(200)

  t.is(orderLine.metadata.test, true)
})

test('updates an order line and changes amounts', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'order:read:all',
      'orderLine:edit:all'
    ]
  })

  const { body: orderLine } = await request(t.context.serverUrl)
    .patch('/order_lines/ordl_KdA9vs1st51h6q3wst5')
    .set(authorizationHeaders)
    .send({
      senderAmount: 2200,
      platformAmount: 200,
      metadata: { test: true }
    })
    .expect(200)

  t.is(orderLine.senderAmount, 2200)
  t.is(orderLine.platformAmount, 200)
  t.is(orderLine.metadata.test, true)

  const { body: afterOrder } = await request(t.context.serverUrl)
    .get('/orders/ord_eP0hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  t.is(afterOrder.amountDue, 2200)
  t.is(afterOrder.amountPaid, 0)
})

// ORDER MOVE

test('finds an order move', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['orderMove:read:all'] })

  const { body: orderMove } = await request(t.context.serverUrl)
    .get('/order_moves/ordm_yJLKVs101Q1gDyYe01Q')
    .set(authorizationHeaders)
    .expect(200)

  t.is(orderMove.id, 'ordm_yJLKVs101Q1gDyYe01Q')
})

test('creates an order move', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'order:read:all',
      'orderMove:create:all'
    ]
  })

  const { body: beforeOrder } = await request(t.context.serverUrl)
    .get('/orders/ord_ax1hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  const { body: orderMove } = await request(t.context.serverUrl)
    .post('/order_moves')
    .set(authorizationHeaders)
    .send({
      orderId: 'ord_ax1hwes1jwf1gxMLCjwf',
      transactionId: 'trn_a3BfQps1I3a1gJYz2I3a',
      senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      senderAmount: 10,
      currency: 'EUR'
    })
    .expect(200)

  t.is(orderMove.transactionId, 'trn_a3BfQps1I3a1gJYz2I3a')
  t.is(orderMove.senderId, 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c')
  t.is(orderMove.senderAmount, 10)

  const { body: afterOrder } = await request(t.context.serverUrl)
    .get('/orders/ord_ax1hwes1jwf1gxMLCjwf')
    .set(authorizationHeaders)
    .expect(200)

  t.is(beforeOrder.amountPaid + orderMove.senderAmount, afterOrder.amountPaid)
})

test('updates an order move', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['orderMove:edit:all'] })

  const { body: orderMove } = await request(t.context.serverUrl)
    .patch('/order_moves/ordm_yJLKVs101Q1gDyYe01Q')
    .set(authorizationHeaders)
    .send({
      metadata: { test: true }
    })
    .expect(200)

  t.is(orderMove.metadata.test, true)
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create an order if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/orders')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/orders')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      transactionIds: true,
      lines: true,
      moves: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"transactionIds" must be a string'))
  t.true(error.message.includes('"lines" must be an array'))
  t.true(error.message.includes('"moves" must be an array'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to update an order if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/orders/ord_eP0hwes1jwf1gxMLCjwf')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/orders/ord_eP0hwes1jwf1gxMLCjwf')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to create an order line if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/order_lines')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/order_lines')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"orderId" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/order_lines')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      orderId: true,
      transactionId: true,
      reversal: 'invalid',
      senderId: true,
      senderAmount: true,
      receiverId: true,
      receiverAmount: true,
      platformAmount: true,
      currency: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"orderId" must be a string'))
  t.true(error.message.includes('"transactionId" must be a string'))
  t.true(error.message.includes('"reversal" must be a boolean'))
  t.true(error.message.includes('"senderId" must be a string'))
  t.true(error.message.includes('"senderAmount" must be a number'))
  t.true(error.message.includes('"receiverId" must be a string'))
  t.true(error.message.includes('"receiverAmount" must be a number'))
  t.true(error.message.includes('"platformAmount" must be a number'))
  t.true(error.message.includes('"currency" must be a string'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to update an order line if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/order_lines/ordl_BPlQws16p51gKm3w6p5')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/order_lines/ordl_BPlQws16p51gKm3w6p5')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to create an order move if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/order_moves')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/order_moves')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"orderId" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/order_moves')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      orderId: true,
      transactionId: true,
      reversal: 'invalid',
      senderId: true,
      senderAmount: true,
      receiverId: true,
      receiverAmount: true,
      platformAmount: true,
      currency: true,
      real: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"orderId" must be a string'))
  t.true(error.message.includes('"transactionId" must be a string'))
  t.true(error.message.includes('"reversal" must be a boolean'))
  t.true(error.message.includes('"senderId" must be a string'))
  t.true(error.message.includes('"senderAmount" must be a number'))
  t.true(error.message.includes('"receiverId" must be a string'))
  t.true(error.message.includes('"receiverAmount" must be a number'))
  t.true(error.message.includes('"platformAmount" must be a number'))
  t.true(error.message.includes('"currency" must be a string'))
  t.true(error.message.includes('"real" must be of type object'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to update an order move if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/order_moves/ordm_yJLKVs101Q1gDyYe01Q')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/order_moves/ordm_yJLKVs101Q1gDyYe01Q')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      real: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"real" must be of type object'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

// ////// //
// EVENTS //
// ////// //

// Event tests must run serially before the other tests
test.serial('generates order__* events', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'order:create:all',
      'order:edit:all',
      'event:list:all',
      'platformData:edit:all'
    ],
    readNamespaces: ['*'],
    editNamespaces: ['*']
  })

  const { body: order } = await request(t.context.serverUrl)
    .post('/orders')
    .set(authorizationHeaders)
    .send({
      transactionIds: ['trn_a3BfQps1I3a1gJYz2I3a', 'trn_RjhfQps1I3a1gJYz2I3a'],
      metadata: { dummy: true }
    })
    .expect(200)

  const patchPayload = {
    metadata: {
      dummy: false
    },
    platformData: {
      test: 1
    }
  }

  const { body: orderUpdated } = await request(t.context.serverUrl)
    .patch(`/orders/${order.id}`)
    .set(authorizationHeaders)
    .send(patchPayload)
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const orderCreatedEvent = getObjectEvent({
    events,
    eventType: 'order__created',
    objectId: order.id
  })
  await testEventMetadata({ event: orderCreatedEvent, object: order, t })
  t.is(orderCreatedEvent.object.metadata.dummy, true)

  const orderUpdatedEvent = getObjectEvent({
    events,
    eventType: 'order__updated',
    objectId: orderUpdated.id
  })
  await testEventMetadata({
    event: orderUpdatedEvent,
    object: orderUpdated,
    t,
    patchPayload
  })
  t.is(orderUpdatedEvent.object.metadata.dummy, false)
})
