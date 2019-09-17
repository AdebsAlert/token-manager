# Softoken 

`Redis` and `JWT` token based session manager.

## Usage

You will need [redis](http://redis.io) to use this package.  

`npm install --save softoken`

### Configure

```javascript
var Softoken = require('softoken')
var session = new Softoken({
  jwtSecret: 'secret',
  [namespace]: 'ts',
  [redis]: ioredisInstance,
  [cleanupManual]: false
})

```

### Create

```javascript
session.create({
  uid: '1',
  [ttl]: 7200,
  [ip]: '127.0.0.1'
})
.then(function (jwtToken) { ... })
```

### Get

```javascript
session.get('token')
.then(function (session) { ... })
```

### Destroy

```javascript
session.destroy('token')
.then(function (isSuccess) { ... })
```

### Extend

The second ttl parameter is optional.

```javascript
session.extend('token', 7200)
.then(function (expiresAt) { ... })
```

### Get user's sessions

```javascript
session.getByUserId('1').then(function (sessions) { ... })
```

### Destroy user's sessions

```javascript
session.destroyUser('1').then(function (isSuccess) { ... })
```

### Cleanup

For manual session cleanup.

To clear only expired sessions

```javascript
session.cleanup().then(function () { ... })
```

To clear every session

```javascript
session.cleanup(true).then(function () { ... })
```
