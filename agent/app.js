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

app.configure('production|development', 'connector|master|hall|db', function() {
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
app.configure('production|development', 'hall', function() {
    //app.set('connectorConfig', { useProtobuf: true });
  //扫描热更新
  hot.scan(app.getBase() + "/app/common");
  hot.scan(app.getBase() + "/app/services");
  //游戏服务器配置
  app.loadConfig('gameServerConfig', app.getBase() + '/config/gameServer.json');
  //PHP API 服务器配置
  app.loadConfig('apiServerConfig', app.getBase() + '/config/apiServer.json');

  //游戏服务器，apiserver连接启动组件
  app.load(require(app.getBase() + '/app/component/GameServerComponent'), {});
  //用户管理
  app.set("usermanager", hot.get("UserManager", require(app.getBase() + '/app/services/UserManager')));
  //常量
  app.set("gameconst", hot.get("GameConst", require(app.getBase() + '/app/common/GameConst')));
  //通道管理
  app.set("cm", hot.get("ChannelManager", require(app.getBase() + '/app/services/ChannelManager')));
  //游戏服务器管理
  app.set("gameserverManager", hot.get("GameServerManager", require(app.getBase() + '/app/services/GameServerManager')));
  //PHPAPI管理
  app.set("phpApiServer", hot.get("PhpApiServer", require(app.getBase() + '/app/services/PhpApiServer')));
  //游戏通道管理
  app.set("gamechannel", hot.get("GameChannelManager", require(app.getBase() + '/app/services/game/PlayerToGameChannel')));
  //聊天
  app.set("chatService", hot.get("ChatService", require(app.getBase() + '/app/services/ChatService')));
  app.set("mjP2PService", hot.get("MahjongP2PService", require(app.getBase() + '/app/services/p2p/MahjongP2PService')));
  app.set("matchServer", hothelper.getMatchServer());
  app.set("matchCSServer", hothelper.getMatchCSServer());
  app.set("matchCGServer", hothelper.getMatchCGServer());
  app.set("matchYQServer", hothelper.getMatchYQServer());
  app.set("temporaryBadTable", hot.get("TemporaryBadTable", require(app.getBase() + '/app/services/p2p/TemporaryBadTable')));
  app.set("randomAssignGameTable", hot.get("RandomAssignGameTable", require(app.getBase() + '/app/services/p2p/RandomAssignGameTable')));
  //金币场
  app.set("goldService", hothelper.getGoldService());
});

app.configure('production|development', 'db', function() {
  //扫描热更新
  hot.scan(app.getBase() + "/app/common");
  hot.scan(app.getBase() + "/app/services");
  //mysql配置
  app.loadConfig('mysql', app.getBase() + '/config/mysql.json');
  //db
  app.set('db', require(app.getBase() + '/app/net/DB').init(app));
  //db操作
  app.set("dbManager", hothelper.getDBManager());
});


// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});
