var Redis = require('ioredis')
var expect = require('chai').expect
var jwt = require('jsonwebtoken')

var Softoken = require('../index')

describe('e2e', () => {
  var redis = new Redis({
    db: 1
  })

  var softoken = new Softoken({
    redis: redis,
    cleanupManual: true,
    jwtSecret: 'secret'
  })

  before(function *() {
    yield redis.flushall()
  })

  describe('#create', () => {
    it('should create a session', function *() {
      var expireAt = Date.now() + 7200000
      var token = yield softoken.create({
        uid: '1'
      })

      var tokenPayload = yield jwt.verify(token, 'secret')
      var props = yield redis.hgetall(softoken.namespaceKey + 't:' + token)

      expect(tokenPayload).to.have.property('uid', '1')

      expect(props).to.have.property('uid', '1')
      expect(props).to.have.property('exp')
      expect(Number(props.exp)).to.be.at.least(expireAt)
    })

    it('should create a session which expires', function *() {
      var token = yield softoken.create({
        uid: '1'
      })

      var ttl = yield redis.pttl(softoken.namespaceKey + 't:' + token)

      expect(ttl).to.be.above(7198000)
      expect(ttl).to.be.below(7200000)
    })

    afterEach(function *() {
      yield redis.flushall()
    })
  })

  describe('#extend', () => {
    var token

    beforeEach(function *() {
      token = yield softoken.create({
        uid: '1',
        ttl: 2
      })
    })

    it('should extend a session expiration', function *() {
      var expireAt = Date.now() + 7200000

      yield softoken.extend(token)

      // expect
      var tokenKey = softoken.namespaceKey + 't:' + token
      var props = yield redis.hgetall(tokenKey)
      var ttl = yield redis.pttl(tokenKey)

      expect(ttl).to.be.above(7198000)
      expect(ttl).to.be.below(7200000)

      expect(Number(props.exp)).to.be.at.least(expireAt)
    })

    it('should handle if token is invalid', function *() {
      try {
        yield softoken.extend('a.a.b')
      } catch (err) {
        expect(err.message).to.be.equal('invalid token')
        return
      }

      throw new Error('unhandled error')
    })

    afterEach(function *() {
      yield redis.flushall()
    })
  })

  describe('#get', () => {
    var token

    beforeEach(function *() {
      token = yield softoken.create({
        uid: '1',
        ip: '192.168.1.1'
      })
    })

    afterEach(function *() {
      yield softoken.destroy(token)
    })

    it('should return with session', function *() {
      var props = yield softoken.get(token)

      expect(props).to.have.property('uid', '1')
      expect(props).to.have.property('ip', '192.168.1.1')
    })

    it('should reject malformed token', function *() {
      try {
        yield softoken.get('invalid token')
      } catch (err) {
        expect(err.message).to.be.equal('jwt malformed')
        return
      }

      throw new Error('unhandled error')
    })

    it('should reject invalid token', function *() {
      try {
        yield softoken.get('a.a.b')
      } catch (err) {
        expect(err.message).to.be.equal('invalid token')
        return
      }

      throw new Error('unhandled error')
    })

    it('should reject unknown token', function *() {
      var token = jwt.sign({
        uid: '1'
      }, softoken.jwtSecret)

      try {
        yield softoken.get(token)
      } catch (err) {
        expect(err.message).to.be.equal('unknown token')
        return
      }

      throw new Error('unhandled error')
    })

    afterEach(function *() {
      yield redis.flushall()
    })
  })

  describe('#getByUserId', () => {
    var token1
    var token2

    beforeEach(function *() {
      var result = yield {
        token1: softoken.create({
          uid: '1',
          ip: '192.168.1.1'
        }),

        token2: softoken.create({
          uid: '1',
          ip: '192.168.1.2'
        })
      }

      token1 = result.token1
      token2 = result.token2
    })

    afterEach(function *() {
      yield [softoken.destroy(token1), softoken.destroy(token2)]
    })

    it('should return with user\'s sessions', function *() {
      var sessions1 = yield softoken.getByUserId('1')
      var sessions2 = yield softoken.getByUserId('2')

      expect(sessions1.length).to.be.equal(2)
      expect(sessions1[0]).property('uid', '1')
      expect(sessions1[0]).property('ip')
      expect(sessions1[1]).property('uid', '1')
      expect(sessions1[1]).property('ip')

      expect(sessions2.length).to.be.equal(0)
    })
  })

  describe('#destroy', () => {
    var token

    beforeEach(function *() {
      token = yield softoken.create({
        uid: '1'
      })
    })

    it('should return with session', function *() {
      var iSuccess = yield softoken.destroy(token)

      // expect
      var userTokens = yield redis.smembers(softoken.namespaceKey + 'u:1')
      var tokens = yield redis.zrangebyscore(softoken.namespaceKey + 't:list', 0, '+inf')
      var props = yield redis.hgetall(softoken.namespaceKey + 't:' + token)

      expect(iSuccess).to.be.true
      expect(userTokens).to.be.eql([])
      expect(tokens).to.be.eql([])
      expect(props).to.be.eql({})
    })

    afterEach(function *() {
      yield redis.flushall()
    })
  })

  describe('#destroy user', () => {
    var token1
    var token3

    beforeEach(function *() {
      token1 = yield softoken.create({
        uid: '1'
      })

      yield softoken.create({
        uid: '1'
      })

      token3 = yield softoken.create({
        uid: '2'
      })
    })

    it('should remove user and user\'s tokens', function *() {
      var iSuccess = yield softoken.destroyUser('1')

      // expect
      var userTokens = yield redis.smembers(softoken.namespaceKey + 'u:1')
      var tokens = yield redis.zrangebyscore(softoken.namespaceKey + 't:list', 0, '+inf')
      var props = yield redis.hgetall(softoken.namespaceKey + 't:' + token1)

      expect(iSuccess).to.be.true
      expect(userTokens).to.be.eql([])
      expect(tokens).to.be.eql([
        '2:' + token3
      ])
      expect(props).to.be.eql({})
    })

    afterEach(function *() {
      yield redis.flushall()
    })
  })

  describe('#cleanup', () => {
    beforeEach(function *() {
      yield softoken.create({
        uid: '1',
        ttl: 0
      })
    })

    it('should remove all sessions', function *() {
      yield softoken.cleanup(true)

      var key = yield redis.randomkey()

      expect(key).to.be.null
    })

    it('should remove expired sessions', function *() {
      yield softoken.cleanup()

      var key = yield redis.randomkey()

      expect(key).to.be.null
    })

    it('should remove only expired sessions', function *() {
      var token2 = yield softoken.create({
        uid: '1'
      })

      yield softoken.cleanup()

      var tokens = yield redis.smembers(softoken.namespaceKey + 'u:1')

      expect(tokens).to.be.eql([
        token2
      ])
    })
  })
})
