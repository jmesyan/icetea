var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'agent');

//载入热更新
var hot = require("hotwork");
var hothelper = require("./app/services/HotHelper");

// app configuration
app.configure('production|development', 'connector', function(){
  app.set('connectorConfig',
    {
      connector : pomelo.connectors.hybridconnector,
      heartbeat : 3,
      useDict : true,
      useProtobuf : true
    });
});

app.configure('production|development', 'connector|master|game|db', function() {
  //memcache配置
  app.loadConfig('memcached', app.getBase() + '/config/memcached.json');
  //cache
  app.set('cache', hot.get("Cache", require(app.getBase() + '/app/common/Cache')));
  //lock
  // app.set('lock', require(app.getBase() + '/app/net/MemLock'));
  //tools
  app.set('tools', require(app.getBase() + '/app/gameutils/Tools'));

  //多语言
  app.set("locale", hot.get("LocaleManager", require(app.getBase() + '/app/services/LocaleManager')));
  //handler 热更新开关
  app.set('serverConfig', { reloadHandlers: true });
  //remote 热更新开关
  app.set('remoteConfig', { reloadRemotes: true });
});

// app configure
app.configure('production|development', 'game', function() {
    //扫描热更新
    hot.scan(app.getBase() + "/app/common");
    hot.scan(app.getBase() + "/app/services");
    app.set("gameconst", hothelper.getGameConst());
    //游戏服务器配置
    app.loadConfig('gameServerConfig', app.getBase() + '/config/gameServer.json');
    //游戏服务器，apiserver连接启动组件
    app.load(require(app.getBase() + '/app/component/GameServerComponent'), {});
    //游戏服务器管理
    app.set("gameserverManager", require(app.getBase() + '/app/services/GameServerManager'));
    // app.filter(pomelo.timeout());
});


// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});
