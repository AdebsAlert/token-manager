var http = require('http')
var koa = require('koa')
var request = require('co-supertest')

var Softoken = require('../../index.js')
var middleware = require('./koa')

describe('koa middleware e2e', () => {
  var token
  var softoken

  before(function *() {
    softoken = new Softoken({
      jwtSecret: 'secret'
    })

    token = yield softoken.create({
      uid: '1'
    })
  })

  after(function *() {
    yield softoken.cleanup(true)
  })

  it('should accept token', function *() {
    var app = koa()
    app.use(middleware(softoken))
    app.use(function *() {
      this.body = 'hello'
    })

    var server = http.createServer(app.callback())

    yield request(server)
      .get('/')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, 'hello')
  })

  it('should reject token', function *() {
    var app = koa()
    app.use(middleware(softoken))
    app.use(function *() {
      this.body = 'hello'
    })

    var server = http.createServer(app.callback())

    yield request(server)
      .get('/')
      .set('Authorization', `Bearer a.b.c`)
      .expect(401)
  })
})
