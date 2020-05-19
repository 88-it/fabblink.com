import * as types from 'src/store/mutation-types'

import EventBus from 'src/utils/event-bus'

export default {
  [types.TOGGLE_AUTH_DIALOG] (state, { visible, persistent } = {}) {
    state.authDialogOpened = typeof visible === 'boolean' ? visible : !state.authDialogOpened
    state.authDialogPersistent = typeof persistent === 'boolean' ? persistent : state.authDialogPersistent
  },

  [types.SET_AUTH_DIALOG_FORM_TYPE] (state, { formType } = {}) {
    const allowedFormTypes = [
      'login',
      'signup',
      'lostPassword',
      'resetPassword',
      'changePassword'
    ]

    if (allowedFormTypes.includes(formType)) {
      state.authDialogFormType = formType
    }
  },

  [types.SET_AUTH_DIALOG_REDIRECTION_AFTER_SIGNUP] (state, { redirectAfterSignup }) {
    state.redirectAfterSignup = redirectAfterSignup
  },

  [types.SET_AUTH_DIALOG_ACTION] (state, { action }) {
    state.authDialogAction = action
  },

  [types.SET_RESET_PASSWORD_TOKEN] (state, { resetToken }) {
    state.resetPasswordToken = resetToken
  },

  [types.SET_CURRENT_USER] (state, { user }) {
    state.user = user

    // emit an event to recreate the socket
    // for the new current user
    refreshSocket()
  },

  [types.SET_REQUESTER_NAME] (state, { name }) {
    state.requesterName = name
  }
}

function refreshSocket () {
  EventBus.$emit('refreshSocket')
}
