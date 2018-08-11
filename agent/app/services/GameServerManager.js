var log = require('pomelo-logger').getLogger("game", "GameServerManager");
var pomelo = require('pomelo');
require("./protos/decode.js");
var nano = require("./nano/nano.js");

var GameServerManager = function() {
    this.$id = "GameServerManager";
    this.$scope = "singleton";
    this.key = null;
    this.host = null;
    this.port = null;
    this.ticker = 0;
};

var gs = GameServerManager.prototype;
gs.start = function() {
    var self = this;
    this.ticker = 0;
    this.callbacks = {};
    var config = pomelo.app.get("gameServerConfig");
    this.host = config.host;
    this.port = config.port;
    this.key = config.key;
    nano.init({
        host: config.host,
        port: config.port,
        path: '/nano',
        user: {},
        handshakeCallback : function(){}
    }, function() {
        console.log('success');
        nano.on("onMembers", onMembers);
        nano.request("room.join", {}, join);
    });
};

var join = function (data) {
     console.log("the join reponse is:", data);
     if (data.Code == 0){
         nano.on("onNewUser", onNewUser);
         nano.on('onMessage', onMessage);
         nano.notify('room.message', {Name: "jmesyan", Content: "i want to talk"});
     }

};

var onNewUser = function (data) {
    console.log("add new user:",data);
};

var onMembers = function (data) {
    console.log("onMembers data is:", data);
};

var onMessage = function (msg) {
    console.log("the msg is:", msg);
};

module.exports = GameServerManager;