var log = require('pomelo-logger').getLogger('game', 'GameServerCommponent');
var pomelo = require("pomelo");
var GameServerManager = require("../services/GameServerManager");

module.exports = function(app, opts) {
    return new GameServerComponent(app, opts);
};

var GameServerComponent = function(app, opts) {

};

GameServerComponent.name = '__GameServerComponent__';
var server = GameServerComponent.prototype;

server.start = function(cb) {
    console.log("GameServerComponent start");
    process.nextTick(cb);
};

server.afterStart = function(cb) {
    // log.warn('GameServers will start Listen afterStart 1000s');
    console.log("GameServerComponent init");
    setTimeout(function() {
        var c = pomelo.app.get("gameServerConfig");
        // console.log( "the type of GameServerManager is:", typeof GameServerManager, ", the GameServerManager is:",GameServerManager);
        var manager = new GameServerManager();
        if (c && c.host) manager.start();
    }, 2000);

    process.nextTick(cb);
};

server.stop = function(force, cb) {
    console.log("GameServerComponent end");
    process.nextTick(cb);
};