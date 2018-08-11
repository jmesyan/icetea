var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'agent');

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

// app configure
app.configure('production|development', 'game', function() {
    // filter configures
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
