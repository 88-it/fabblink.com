const { computeDate } = require('../src/util/time')
const { getModels } = require('../src/models')
const { roundDecimal } = require('../src/util/math')
const WebhookManager = require('./webhook-manager')
const _ = require('lodash')

/**
 * May be required to let event propagate before moving on with current test
 * @constant {Number} testEventDelay
 * @default
 */
const testEventDelay = 1000 // ms

module.exports = {
  testEventDelay,
  WebhookManager,

  computeDate,
  nullOrUndefinedFallback,
  getObjectEvent,
  testEventMetadata,
  checkStatsObject
}

/**
 * Checks if value is undefined or null and returns the value if it is not, fallbackValue otherwise.
 * @param {Any} value
 * @param {Any} fallbackValue
 * @return {Any} value or fallback
 */
function nullOrUndefinedFallback (value, fallbackValue) {
  return (typeof value === 'undefined' || value === null) ? fallbackValue : value
}

/**
 * Finds first event of given type related to a single object
 * @param {Object} params
 * @param {Array} params.events - Array of Event objects
 * @param {String} params.eventType - like 'asset__created'
 * @param {String} params.objectId
 * @return {Object} Event object
 */
function getObjectEvent ({ events, eventType, objectId }) {
  if (_.isEmpty(events)) throw new Error('No events to search for object event')
  return events.find(event => event.type === eventType && event.objectId === objectId)
}

/**
 * Includes boilerplate Event tests
 * @param {Object} params
 * @param {Object} params.t - Test execution object like ava’s 't'
 * @param {Object} params.event - event Object
 * @param {Object} params.object - Object to compare as a reference
 * @param {Object} [params.metadata] - expected event.metadata
 * @param {Object} [params.relatedObjectsIds] - Needed for related ids not root properties of `object`
 * @param {Object} [params.patchPayload] - If testing update
 * @return {Object} Event object
 */
async function testEventMetadata ({
  t,
  event,
  object,
  metadata,
  relatedObjectsIds,
  patchPayload
}) {
  const { Event } = await getModels({
    platformId: t.context.platformId,
    env: t.context.env
  })
  const shouldHaveChangesRegex = Event.hasChangesRequested
  const shouldHaveObjectRegex = Event.hasObjectRegex
  const shouldHaveRelatedObjectsIdsRegex = Event.hasRelatedObjectsIdsRegex

  if (!t || typeof t.fail !== 'function') throw new Error('Missing test execution object')
  if (_.isEmpty(event)) t.fail('Missing event')
  if (_.isEmpty(object)) t.fail('Missing object')
  if (!event.type) t.fail(`Missing event type, id: ${event.id}`)
  if (shouldHaveChangesRegex.test(event.type) && _.isUndefined(patchPayload)) {
    t.fail(`Missing patchPayload for ${event.type} event`)
  }

  const testMessage = event.type
  const objectType = event.objectType || _.camelCase(event.type.split('__')[0])
  const relatedIds = Object.assign(_.pick(object, Event.relatedObjectsWhitelist), relatedObjectsIds)
  const shouldHaveObject = shouldHaveObjectRegex.test(event.type)
  const shouldHaveRelatedObjectsIds = shouldHaveRelatedObjectsIdsRegex.test(event.type)
  const shouldHaveChangesRequested = shouldHaveChangesRegex.test(event.type)

  t.truthy(event, testMessage)
  t.is(event.objectId, object.id, testMessage)
  t.is(event.objectType, objectType, testMessage)

  if (shouldHaveObject) {
    t.true(event.object.id === object.id, testMessage)
    t.deepEqual(event.object.metadata, object.metadata)
    t.deepEqual(event.object.platformData, object.platformData)
  } else t.true(event.object === null, testMessage)

  const changesRequested = event.changesRequested

  if (shouldHaveChangesRequested) t.deepEqual(changesRequested, patchPayload, testMessage)
  else t.true(event.changesRequested === null, testMessage)

  if (shouldHaveRelatedObjectsIds) t.deepEqual(event.relatedObjectsIds, relatedIds, testMessage)
  else t.true(event.relatedObjectsIds === null, testMessage)

  if (metadata) t.deepEqual(event.metadata, metadata, testMessage)
}

/**
 * @param {Object}   params
 * @param {Object}   params.t - AVA test object
 * @param {Object}   params.obj - stats object returned by API
 * @param {String}   params.groupBy
 * @param {String}   [params.field]
 * @param {Object[]} params.results
 * @param {Boolean}  [params.expandedGroupByField = true]
 *   if false, result has no `groupBy` and `groupByValue`
 *   if true, result has property [`groupBy`] with `groupByValue` as value
 *   true: { groupBy: ..., groupByValue: ... }
 *   false: { [groupBy]: groupByValue }
 * @param {Number}   [avgPrecision = 2] - check the average precision
 * @param {String}   [orderBy = 'count']
 * @param {String}   [order = 'desc']
 * @param {Function} [additionalResultCheckFn] - if defined, will perform additional check on `result`
 */
function checkStatsObject ({
  t,
  obj,
  groupBy,
  field,
  results,
  expandedGroupByField = true,
  avgPrecision = 2,
  orderBy = 'count',
  order = 'desc',
  additionalResultCheckFn
}) {
  // only consider results whose `groupBy` value is not `undefined`
  results = results.filter(e => !_.isUndefined(_.get(e, groupBy)))
  const resultsByType = _.groupBy(results, groupBy)

  t.true(typeof obj === 'object')
  t.true(typeof obj.nbResults === 'number')
  t.true(typeof obj.nbPages === 'number')
  t.true(typeof obj.page === 'number')
  t.true(typeof obj.nbResultsPerPage === 'number')
  t.true(Array.isArray(obj.results))
  t.is(obj.nbResults, obj.results.length)

  obj.results.forEach(result => {
    const key = expandedGroupByField ? result.groupByValue : result[groupBy]
    const results = resultsByType[key] || []
    const count = results.length

    const nullIfNone = (count, nb) => count === 0 ? null : nb

    const avg = nullIfNone(count, results.reduce((nb, r) => nb + _.get(r, field), 0) / results.length)
    const sum = nullIfNone(count, results.reduce((nb, r) => nb + _.get(r, field), 0))
    const min = nullIfNone(count, results.reduce((nb, r) => Math.min(_.get(r, field), nb), _.get(results[0], field)))
    const max = nullIfNone(count, results.reduce((nb, r) => Math.max(_.get(r, field), nb), _.get(results[0], field)))

    if (expandedGroupByField) {
      t.is(result.groupBy, groupBy)
      t.is(typeof result.groupByValue, 'string')
    } else {
      t.is(typeof result[groupBy], 'string')
    }

    t.is(result.count, count)

    if (field) {
      t.is(result.avg, roundDecimal(avg, avgPrecision))

      // Better compare the difference below a small threshold
      // than performing a strict equality because of floating operation precision
      // 8.1 + 8.2 = 16.299999999999997
      const isEqual = (nb1, nb2) => Math.abs(nb1 - nb2) <= 1e-10 // not using Number.EPSILON because it's too small
      t.true(isEqual(result.sum, sum))

      t.is(result.min, min)
      t.is(result.max, max)
    } else {
      t.is(result.avg, null)
      t.is(result.sum, null)
      t.is(result.min, null)
      t.is(result.max, null)
    }
  })

  const totalCount = obj.results.reduce((total, r) => total + r.count, 0)
  t.is(totalCount, results.length)

  // check order
  let number
  obj.results.forEach(result => {
    if (typeof number === 'undefined') {
      number = result[orderBy]
    } else {
      if (order === 'desc') t.true(number >= result[orderBy])
      else t.true(number <= result[orderBy])

      number = result[orderBy]
    }

    if (typeof additionalResultCheckFn === 'function') {
      additionalResultCheckFn(result)
    }
  })
}
