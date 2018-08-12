  var pomelo = require("pomelo");
  var log = require('pomelo-logger').getLogger("game", "nano");
  var Protocol  = require("./protocol");
  var net = require('net');
  var decoder = require("../protos/decode.js");
  var encoder = require("../protos/encode.js");

  var Package = Protocol.Package;
  var Message = Protocol.Message;

  const statusStart = 1;
  const statusHandshake = 2;
  const statusWorking=3;
  const statusClosed=4;

  function Emitter(obj) {
    if (obj) return mixin(obj);
  }
    /**
   * Mixin the emitter properties.
   *
   * @param {Object} obj
   * @return {Object}
   * @api private
   */

  function mixin(obj) {
    for (var key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }

  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.on =
  Emitter.prototype.addEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};
    (this._callbacks[event] = this._callbacks[event] || [])
      .push(fn);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.once = function(event, fn){
    var self = this;
    this._callbacks = this._callbacks || {};

    function on() {
      self.off(event, on);
      fn.apply(this, arguments);
    }

    on.fn = fn;
    this.on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.off =
  Emitter.prototype.removeListener =
  Emitter.prototype.removeAllListeners =
  Emitter.prototype.removeEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};

    // all
    if (0 == arguments.length) {
      this._callbacks = {};
      return this;
    }

    // specific event
    var callbacks = this._callbacks[event];
    if (!callbacks) return this;

    // remove all handlers
    if (1 == arguments.length) {
      delete this._callbacks[event];
      return this;
    }

    // remove specific handler
    var cb;
    for (var i = 0; i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }
    return this;
  };

  /**
   * Emit `event` with the given args.
   *
   * @param {String} event
   * @param {Mixed} ...
   * @return {Emitter}
   */

  Emitter.prototype.emit = function(event){
    this._callbacks = this._callbacks || {};
    var args = [].slice.call(arguments, 1)
      , callbacks = this._callbacks[event];

    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }

    return this;
  };

  /**
   * Return array of callbacks for `event`.
   *
   * @param {String} event
   * @return {Array}
   * @api public
   */

  Emitter.prototype.listeners = function(event){
    this._callbacks = this._callbacks || {};
    return this._callbacks[event] || [];
  };

  /**
   * Check if this emitter has `event` handlers.
   *
   * @param {String} event
   * @return {Boolean}
   * @api public
   */

  Emitter.prototype.hasListeners = function(event){
    return !! this.listeners(event).length;
  };
  var JS_WS_CLIENT_TYPE = 'js-websocket';
  var JS_WS_CLIENT_VERSION = '0.0.1';

  // var Protocol = window.Protocol || Protocol;
  var decodeIO_encoder = encoder;
  var decodeIO_decoder = decoder;
  var Package = Protocol.Package;
  var Message = Protocol.Message;
  var EventEmitter = Emitter;
  var rsa = '';

  var RES_OK = 200;
  var RES_FAIL = 500;
  var RES_OLD_CLIENT = 501;

  var AGENT_STATUS = 0;

  if (typeof Object.create !== 'function') {
    Object.create = function (o) {
      function F() {}
      F.prototype = o;
      return new F();
    };
  }

  // var root = window;
  var nano = Object.create(EventEmitter.prototype); // object extend from object
  // root.nano = nano;
  var socket = null;
  var reqId = 0;
  var callbacks = {};
  var handlers = {};
  //Map from request id to route
  var routeMap = {};
  var dict = {};    // route string to code
  var abbrs = {};   // code to route string

  var heartbeatInterval = 0;
  var heartbeatLastAt = 0;
  // var heartbeatTimeout = 0;
  // var nextHeartbeatTimeout = 0;
  var gapThreshold = 100;   // heartbeat gap threashold
  var heartbeatId = null;
  // var heartbeatTimeoutId = null;
  var handshakeCallback = null;
  var heartbeatData = null;

  var decode = null;
  var encode = null;

  var reconnect = false;
  var reconncetTimer = null;
  var reconnectUrl = null;
  var reconnectAttempts = 0;
  var reconnectionDelay = 5000;
  var DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

  var useCrypto;

  // var handshakeBuffer = {
  //   'sys': {
  //     type: JS_WS_CLIENT_TYPE,
  //     version: JS_WS_CLIENT_VERSION,
  //     rsa: {}
  //   },
  //   'user': {
  //   }
  // };

  var initCallback = null;

  nano.init = function(params, cb) {
    initCallback = cb;
    var host = params.host;
    var port = params.port;
    var path = params.path;
    heartbeatInterval = params.heartbeat*1000 || 10000;
    heartbeatData = {
      "code":200,
      "heartbeat":params.heartbeat
    }

    encode = params.encode || defaultEncode;
    decode = params.decode || defaultDecode;

    var url = 'ws://' + host;
    if(port) {
      url +=  ':' + port;
    }

    if(path) {
      url += path;
    }


    // handshakeBuffer.user = params.user;
    // if(params.encrypt) {
    //   useCrypto = true;
    //   rsa.generate(1024, "10001");
    //   var data = {
    //     rsa_n: rsa.n.toString(16),
    //     rsa_e: rsa.e
    //   };
    //   handshakeBuffer.sys.rsa = data;
    // }
    handshakeCallback = params.handshakeCallback;
    // connect(params, host, port, cb);
    listen(params, port, cb);
  };

  var defaultDecode = nano.decode = function(data) {
    var msg = Message.decode(data);

    if(msg.id > 0){
      msg.route = routeMap[msg.id];
      delete routeMap[msg.id];
      if(!msg.route){
        return;
      }
    }

    msg.body = deCompose(msg);
    return msg;
  };

  var defaultEncode = nano.encode = function(reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;
    if(decodeIO_encoder && decodeIO_encoder.lookup(route)) {
      msg = decodeIO_encoder.build(route).encode(msg);
    } else {
      msg = Protocol.strencode(msg);
    }

    var compressRoute = 0;
    if(dict && dict[route]) {
      route = dict[route];
      compressRoute = 1;
    }

    return Message.encode(reqId, type, compressRoute, route, msg);
  };

  var connect = function(params, host, port, cb) {
    var params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
    // reconnectUrl = url;

    var onopen = function(event) {
      if(!!reconnect) {
        nano.emit('reconnect');
      }
      reset();
      var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer)));
      send(obj);
    };
    var onmessage = function(data) {
      processPackage(Package.decode(data), cb);
      // new package arrived, update the heartbeat timeout
      if(heartbeatTimeout) {
        nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      }
    };
    var onerror = function(event) {
      // nano.emit('io-error', event);
      console.error('socket error: ', event);
    };
    var onclose = function(event) {
      nano.emit('close',event);
      nano.emit('disconnect', event);
      console.log('socket close: ', event);
      if(!!params.reconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnect = true;
        reconnectAttempts++;
        reconncetTimer = setTimeout(function() {
          connect(params, reconnectUrl, cb);
        }, reconnectionDelay);
        reconnectionDelay *= 2;
      }
    };
    socket = net.createConnection(port,host);
    socket.on("connect", onopen);
    socket.on("data", onmessage);
    socket.on("error", onerror);
    socket.on("close", onclose);
  };

  var listen = function(params, port, cb){
      var params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
    // reconnectUrl = url;

    var onopen = function(event) {
      if(!!reconnect) {
        nano.emit('client reconnect');
      }
      reset();

      heartbeatLastAt = Date.now();
      var obj = Package.encode(Package.TYPE_HEARTBEAT);
      if(heartbeatId) clearInterval(heartbeatId);

      heartbeatId = setInterval(function(){
          var deadline = Date.now() - 2*heartbeatInterval;
          console.log("heartbeatcheck:", deadline, heartbeatLastAt, heartbeatLastAt < deadline);
          if (heartbeatLastAt < deadline) {
            console.log("Session heartbeat timeout, LastTime="+heartbeatLastAt+" Deadline="+deadline);
            clearInterval(heartbeatId);
            socket.emit('close');
            return;
          }
          send(obj);
      }, heartbeatInterval);

    };
    var onmessage = function(data) {
      processPackage(Package.decode(data), cb);
      // new package arrived, update the heartbeat timeout
      // if(heartbeatTimeout) {
      //   nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      // }
      heartbeatLastAt = Date.now();
    };
    var onerror = function(event) {
      nano.emit('io-error', event);
      console.error('socket error: ', event);
    };
    var onclose = function(event) {
      nano.emit('close',event);
      nano.emit('disconnect', event);
      console.log('socket close: ', event);
    };

    var server = net.createServer((sck)=>{
      console.log("client connected");
      sck.setNoDelay(true);
      socket = sck;
      onopen(sck);
      sck.on("data", onmessage);
      sck.on("error", onerror);
      sck.on("close", onclose);
    });

    server.on('error', (err) => {
      throw err;
    });

    server.listen(port, () => {
      console.log('server bound at the port:'+ port);
    });
  };

  nano.disconnect = function() {
    if(socket) {
      if(socket.disconnect) socket.disconnect();
      if(socket.close) socket.close();
      console.log('disconnect');
      socket = null;
    }

    if(heartbeatId) {
      clearTimeout(heartbeatId);
      heartbeatId = null;
    }
    if(heartbeatTimeoutId) {
      clearTimeout(heartbeatTimeoutId);
      heartbeatTimeoutId = null;
    }
  };

  var reset = function() {
    reconnect = false;
    // reconnectionDelay = 1000 * 5;
    // reconnectAttempts = 0;
    // clearTimeout(reconncetTimer);
  };

  nano.request = function(route, msg, cb) {
    if(arguments.length === 2 && typeof msg === 'function') {
      cb = msg;
      msg = {};
    } else {
      msg = msg || {};
    }
    route = route || msg.route;
    if(!route) {
      return;
    }

    reqId++;
    sendMessage(reqId, route, msg);

    callbacks[reqId] = cb;
    routeMap[reqId] = route;
  };

  nano.notify = function(route, msg) {
    msg = msg || {};
    sendMessage(0, route, msg);
  };

  var sendMessage = function(reqId, route, msg) {
    if(useCrypto) {
      msg = JSON.stringify(msg);
      var sig = rsa.signString(msg, "sha256");
      msg = JSON.parse(msg);
      msg['__crypto__'] = sig;
    }

    if(encode) {
      msg = encode(reqId, route, msg);
    }

    var packet = Package.encode(Package.TYPE_DATA, msg);
    send(packet);
  };

  var send = function(packet) {
    if(socket && socket.write) socket.write(Buffer.from(packet.buffer));
    else console.log("the socket is closed, the data you want to send is:", packet.buffer);
  };

  var handler = {};

  var heartbeat = function(data) {
    console.log("heartbeat come:", data.toString());
    // if(!heartbeatInterval) {
    //   // no heartbeat
    //   return;
    // }

    // var obj = Package.encode(Package.TYPE_HEARTBEAT);
    // if(heartbeatTimeoutId) {
    //   clearTimeout(heartbeatTimeoutId);
    //   heartbeatTimeoutId = null;
    // }

    // if(heartbeatId) {
    //   // already in a heartbeat interval
    //   return;
    // }
    // heartbeatId = setTimeout(function() {
    //   heartbeatId = null;
    //   send(obj);

    //   nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
    //   heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout);
    // }, heartbeatInterval);
  };

  var heartbeatTimeoutCb = function() {
    var gap = nextHeartbeatTimeout - Date.now();
    if(gap > gapThreshold) {
      heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap);
    } else {
      console.error('server heartbeat timeout');
      nano.emit('heartbeat timeout');
      nano.disconnect();
    }
  };

  var handshake = function(data) {
    // data = JSON.parse(Protocol.strdecode(data));
    // if(data.code === RES_OLD_CLIENT) {
    //   nano.emit('error', 'client version not fullfill');
    //   return;
    // }

    // if(data.code !== RES_OK) {
    //   nano.emit('error', 'handshake fail');
    //   return;
    // }

    // handshakeInit(data);

    // var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
    // send(obj);
    // if(initCallback) {
    //   initCallback(socket);
    // }

    AGENT_STATUS = statusHandshake;
    var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(heartbeatData)));
    send(obj);

  };

  var handshakeack = function(data){
     AGENT_STATUS = statusWorking;
     if(initCallback) {
        initCallback(socket);
     }
  }

  var onData = function(data) {
    var msg = data;
    if(decode) {
      msg = decode(msg);
    }
    processMessage(nano, msg);
  };

  var onKick = function(data) {
    data = JSON.parse(Protocol.strdecode(data));
    nano.emit('onKick', data);
  };

  handlers[Package.TYPE_HANDSHAKE] = handshake;
  handlers[Package.TYPE_HANDSHAKE_ACK] = handshakeack;
  handlers[Package.TYPE_HEARTBEAT] = heartbeat;
  handlers[Package.TYPE_DATA] = onData;
  handlers[Package.TYPE_KICK] = onKick;

  var processPackage = function(msgs) {
    if (msgs && msgs.type < 4) console.log("processPackage:", msgs.body.toString());
    if(Array.isArray(msgs)) {
      for(var i=0; i<msgs.length; i++) {
        var msg = msgs[i];
        if (AGENT_STATUS < statusWorking && msg.type == 4){
          console.log("receive data on socket which not yet ACK, will disconnect client");
          socket.emit('close');
          return
        } else {
           handlers[msg.type](msg.body);
        }
       
      }
    } else {
       if (AGENT_STATUS < statusWorking && msgs.type == 4){
        console.log("receive data on socket which not yet ACK, will disconnect client");
        socket.emit('close');
        return
      } else {
          handlers[msgs.type](msgs.body);
      }
    }
  };

  var processMessage = function(nano, msg) {
    if(!msg.id) {
      // server push message
      nano.emit(msg.route, msg.body);
      return;
    }

    //if have a id then find the callback function with the request
    var cb = callbacks[msg.id];

    delete callbacks[msg.id];
    if(typeof cb !== 'function') {
      return;
    }

    cb(msg.body);

  };

  var processMessageBatch = function(nano, msgs) {
    for(var i=0, l=msgs.length; i<l; i++) {
      processMessage(nano, msgs[i]);
    }
  };

  var deCompose = function(msg) {
    var route = msg.route;

    //Decompose route from dict
    if(msg.compressRoute) {
      if(!abbrs[route]){
        return {};
      }

      route = msg.route = abbrs[route];
    }
    
    if(decodeIO_decoder && decodeIO_decoder.lookup(route)) {
      return decodeIO_decoder.build(route).decode(msg.body);
    } else {
      return Protocol.strdecode(msg.body);
    }

    return msg;
  };

  var handshakeInit = function(data) {
    if(data.sys && data.sys.heartbeat) {
      heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
      heartbeatTimeout = heartbeatInterval * 2;        // max heartbeat timeout
    } else {
      heartbeatInterval = 0;
      heartbeatTimeout = 0;
    }

    initData(data);

    if(typeof handshakeCallback === 'function') {
      handshakeCallback(data.user);
    }
  };

  //Initilize data used in nano client
  var initData = function(data) {
    if(!data || !data.sys) {
      return;
    }
    dict = data.sys.dict;

    //Init compress dict
    if(dict) {
      dict = dict;
      abbrs = {};

      for(var route in dict) {
        abbrs[dict[route]] = route;
      }
    }
  }


  module.exports = nano;
