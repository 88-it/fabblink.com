import { compact, uniqBy, pick } from 'lodash'
import stelace, { fetchAllResults } from 'src/utils/stelace'
import * as types from 'src/store/mutation-types'
import * as api from './api'
import { date } from 'quasar'
import { populateAsset } from 'src/utils/asset'
import { populateUser } from 'src/utils/user'
import EventBus from 'src/utils/event-bus'

export async function fetchAssetsRelatedResources ({ dispatch, state }) {
  await Promise.all([
    // dispatch('fetchCategories'), // uncomment if needed to populate AssetCards
    dispatch('fetchAssetTypes'),
    dispatch('fetchCustomAttributes'),
  ])
}

export function selectSearchMode ({ commit, rootGetters }, { searchMode }) {
  if (!searchMode) return

  const searchOptions = rootGetters.searchOptions
  const mode = searchOptions.modes[searchMode]

  if (mode) {
    commit({
      type: types.SET_SEARCH_MODE,
      searchMode,
      customAttributes: mode.customAttributes
    })
    commit({
      type: types.SEARCH__SET_ASSET_TYPES,
      assetTypesIds: mode.assetTypesIds
    })
  }
}

export async function searchAssets ({ state, rootState, rootGetters, commit, dispatch }, { resetPagination = true } = {}) {
  const {
    categoriesById,
    assetTypesById,
  } = rootState.common
  const {
    currentUser,
    ratingsOptions,
  } = rootGetters

  if (resetPagination) {
    commit({
      type: types.SEARCH__SET_SEARCH_FILTERS,
      page: 1
    })
  }

  const searchFilters = state.searchFilters

  const assets = await api.searchAssets({
    page: searchFilters.page,
    nbResultsPerPage: searchFilters.nbResultsPerPage,
    // preserve sorting by relevance when there is a text query and no explicit sorting order
    orderBy: searchFilters.orderBy || (!state.query ? searchFilters.defaultOrderBy : null),
    order: searchFilters.order,

    query: state.query,
    location: {
      latitude: state.latitude,
      longitude: state.longitude
    },
    filters: Object.assign({}, searchFilters.filters, {
      active: true,
      validated: true,

      // won't show assets that haven't at least one quantity during the specified period
      // or after now if no dates are specified
      quantity: 1,

      startDate: state.startDate,
      endDate: state.endDate,
      assetTypeId: state.assetTypesIds && state.assetTypesIds.length ? state.assetTypesIds : null,

      price: {
        gte: state.priceRange.min,
        lte: state.priceRange.max,
      }
    }),
    availabilityFilter: state.availabilityFilter,
    customAttributesFilters: pick(searchFilters.customAttributesFilters, state.displayCustomAttributes)
  })

  commit({
    type: types.SEARCH__SET_ASSETS,
    assets
  })
  commit({
    type: types.SEARCH__SET_PAGINATION_META,
    nbResults: assets.paginationMeta.nbResults,
    nbPages: assets.paginationMeta.nbPages
  })

  // retrieve all owners associated to assets
  const usersIds = compact(uniqBy(assets.map(asset => asset.ownerId)))

  let users = []

  if (usersIds.length) {
    const fetchUserRequest = (...args) => stelace.users.list(...args)
    users = await fetchAllResults(fetchUserRequest, { id: usersIds })

    commit({
      type: types.SEARCH__SET_USERS,
      users
    })
  }

  const populatedAssets = assets.map(ast => {
    const asset = populateAsset({
      asset: ast,
      usersById: state.usersById,
      categoriesById,
      assetTypesById
    })

    if (asset.owner) {
      populateUser(asset.owner, {
        categoriesById,
        ratingsOptions,
        isCurrentUser: currentUser.id === asset.owner.id,
      })
    }

    return asset
  })

  return {
    assets: populatedAssets,
    users
  }
}

// Used to search on arbitrary parameters as opposed to search filters currently saved in store
export async function fetchAssets ({ state }, { query, filters, orderBy, order, nbResults } = {}) {
  const assets = await api.searchAssets({
    query,
    filters,
    page: 1,
    nbResultsPerPage: nbResults || state.searchFilters.nbResultsPerPage,
    // preserve sorting by relevance when there is a text query and no explicit sorting order
    orderBy: orderBy || (!query ? state.searchFilters.defaultOrderBy : null),
    order
  })

  return assets
}

/* eslint-disable camelcase */
export async function signal_heroStatus ({ commit }, { message }) {
  commit({
    type: types.UPDATE_SEARCH_ASSET,
    heroId: message.heroId,
    hero: message.hero,
    requesterName: message.requesterName,
    visitorMission: message.visitorMission
  })

  if (message.visitorMission) EventBus.$emit('missionRequested', message)
}
/* eslint-enable camelcase */

export function setSearchParamsFromUrl ({ state, commit }, { route }) {
  const { query: routeQuery } = route

  const {
    page,
    nbResultsPerPage,
    orderBy,
    order,
    q: query,
    startDate,
    endDate,
    minPrice,
    maxPrice,
    location: queryLocation,
    lat: latitude,
    lon: longitude
  } = routeQuery

  const searchFilters = {}

  if (page && !isNaN(page)) {
    searchFilters.page = parseInt(page, 10)
  }
  if (nbResultsPerPage && !isNaN(nbResultsPerPage)) {
    searchFilters.nbResultsPerPage = parseInt(nbResultsPerPage, 10)
  }
  if (orderBy) {
    searchFilters.orderBy = orderBy
  }
  if (order) {
    searchFilters.order = order
  }

  commit(Object.assign({}, searchFilters, {
    type: types.SEARCH__SET_SEARCH_FILTERS
  }))

  if (query) {
    commit({
      type: types.SET_SEARCH_QUERY,
      query
    })
  }

  const searchDates = { reset: true }

  if (startDate && date.isValid(startDate)) {
    searchDates.startDate = startDate
  }
  if (endDate && date.isValid(endDate)) {
    searchDates.endDate = endDate
  }

  commit(Object.assign({}, searchDates, {
    type: types.SET_SEARCH_DATES
  }))

  const priceRange = {}
  if (minPrice && !isNaN(minPrice)) {
    priceRange.min = parseInt(minPrice, 10)
  } else {
    priceRange.min = state.priceDefault.min
  }

  if (maxPrice && !isNaN(maxPrice)) {
    priceRange.max = parseInt(maxPrice, 10)
  } else {
    priceRange.max = state.priceDefault.max
  }

  commit(Object.assign({}, priceRange, {
    type: types.SET_PRICE_RANGE
  }))

  if (queryLocation &&
    latitude && !isNaN(latitude) &&
    longitude && !isNaN(longitude)
  ) {
    commit({
      type: types.SET_SEARCH_LOCATION,
      queryLocation,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    })
  }
}
