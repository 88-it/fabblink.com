import { keyBy } from 'lodash'
import * as types from 'src/store/mutation-types'

export default {
  [types.TOGGLE_SEARCH_MAP] (state, { visible, save }) {
    state.showSearchMap = typeof visible === 'boolean' ? visible : !state.showSearchMap
    if (save) state.userShowSearchMap = state.showSearchMap
  },
  [types.TOGGLE_FILTER_DIALOG] (state, { visible } = {}) {
    state.showFilterDialog = typeof visible === 'boolean' ? visible : !state.showFilterDialog
  },
  [types.HIDE_FILTER_DIALOG] (state) {
    state.showFilterDialog = false
  },

  [types.SET_SEARCH_MODE] (state, { searchMode, customAttributes }) {
    state.searchMode = searchMode || 'default'
    state.displayCustomAttributes = customAttributes || []
  },
  [types.SET_SEARCH_QUERY] (state, { query }) {
    state.query = query || ''
  },
  [types.SET_SEARCH_DATES] (state, { startDate, endDate, reset = false }) {
    if (reset) {
      state.startDate = ''
      state.endDate = ''
    }

    // can reset just one date
    if (startDate || startDate === null) state.startDate = startDate || ''
    if (endDate || endDate === null) state.endDate = endDate || ''
  },
  [types.SET_SEARCH_LOCATION] (state, { queryLocation, latitude, longitude }) {
    state.queryLocation = queryLocation
    state.latitude = latitude
    state.longitude = longitude
  },
  [types.UNSET_SEARCH_LOCATION] (state) {
    state.queryLocation = null
    state.latitude = null
    state.longitude = null
  },
  [types.SET_PRICE_RANGE] (state, { min, max, defaults = false }) {
    if (defaults) {
      state.priceDefault.min = min
      state.priceDefault.max = max
    } else {
      state.priceRange.min = min
      state.priceRange.max = max
    }
  },
  [types.SET_DISPLAY_PRICE_RANGE] (state, { min, max }) {
    state.displayPriceRange.min = min
    state.displayPriceRange.max = max
  },

  [types.SET_DISPLAY_SPEED_RANGE] (state, { min, max }) {
    state.displaySpeedRange.min = min
    state.displaySpeedRange.max = max
  },

  [types.SEARCH__SET_ASSETS] (state, { assets }) {
    state.assets = assets
  },

  [types.SEARCH__SET_USERS] (state, { users }) {
    state.usersById = keyBy(users, 'id')
  },

  [types.SEARCH__SET_SEARCH_FILTERS] (state, { page, nbResultsPerPage, orderBy, order, filters, customAttributesFilters, query }) {
    if (typeof page !== 'undefined') {
      state.searchFilters.page = page
    }
    if (typeof nbResultsPerPage !== 'undefined') {
      state.searchFilters.nbResultsPerPage = nbResultsPerPage
    }
    if (typeof orderBy !== 'undefined') {
      state.searchFilters.orderBy = orderBy
    }
    if (typeof order !== 'undefined') {
      state.searchFilters.order = order
    }
    if (typeof filters !== 'undefined') {
      state.searchFilters.filters = Object.assign({}, filters)
    }
    if (typeof customAttributesFilters !== 'undefined') {
      state.searchFilters.customAttributesFilters = Object.assign({}, customAttributesFilters)
    }
    if (typeof query !== 'undefined') {
      state.searchFilters.query = query
    }
  },

  [types.SEARCH__SET_AVAILABILITY_FILTER] (state, { enabled, fullPeriod }) {
    if (typeof enabled !== 'undefined') state.availabilityFilter.enabled = enabled
    if (typeof fullPeriod !== 'undefined') state.availabilityFilter.fullPeriod = fullPeriod
  },

  [types.SEARCH__SET_PAGINATION_META] (state, { nbResults, nbPages }) {
    state.paginationMeta.nbResults = nbResults
    state.paginationMeta.nbPages = nbPages
  },

  [types.SEARCH__SET_ASSET_TYPES] (state, { assetTypesIds }) {
    state.assetTypesIds = assetTypesIds || []
  },

  [types.UPDATE_SEARCH_ASSET] (state, { heroId, hero = {} }) {
    state.assets = state.assets.map(a => {
      if (a.id !== heroId) return a
      else return hero
    })
  },
}
