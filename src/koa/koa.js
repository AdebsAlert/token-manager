var _ = require('lodash')
var Softoken = require('../softoken')

/**
* @method factory
* @param {Softoken} softoken
* @param {Object} opts {
*   [extend]: true
* }
* @return {Generator} middleware
*/
function factory (softoken, opts) {
  var options = _.defaults(opts || {}, {
    extend: true
  })

  if (!(softoken instanceof Softoken)) {
    throw new Error('instance of Softoken is required')
  }

  // middleware
  return function *(next) {
    var token = (this.headers.authorization || '').substring(7)
    var session

    // get session
    try {
      session = yield softoken.get(token)
    } catch (err) {
      err.status = 401
      throw err
    }

    // extend token's expiration
    if (options.extend) {
      yield softoken.extend(token)
    }

    this.state.user = _.merge(this.state.user, {
      id: session.uid
    })

    yield next
  }
}

module.exports = factory
