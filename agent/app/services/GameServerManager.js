var log = require('pomelo-logger').getLogger("game", "GameServerManager");
var pomelo = require('pomelo');
var tools = require('../gameutils/Tools');
var PROTO_PATH = __dirname + "/protos/grpc.proto";
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
const grpcLib = require('@grpc/grpc-js');
const pkgDefine = protoLoader.loadSync(PROTO_PATH);
const protos = grpcLib.loadPackageDefinition(pkgDefine).protos;
var hot = require("./HotHelper");
var serversort = require("./StoreDatas").serversort;
var GameServer = hot.getGameServer();

var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/protos/chat.proto'));

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
    this.url = this.host+":"+this.port
    var server = new grpc.Server();
    server.addService(protos.GrpcService.service, {
        MService:rpcService
    });
    server.bind(this.url, grpc.ServerCredentials.createInsecure());
    server.start();
    console.log("server start");
};


//回调发生器
gs.getTick = function(callback) {
    if (!!callback) {
        this.ticker++;
        if (this.ticker > 65535) {
            this.ticker = 0;
            //清理一半
            for (var i = 0; i < 32768; ++i) {
                delete this.callbacks[i];
            }
        } else if (this.ticker == 32768) {
            //清理一半
            for (var i = 32768; i < 65536; ++i) {
                delete this.callbacks[i];
            }
        }

        this.callbacks[this.ticker] = callback;
        return this.ticker;
    }
    return false;
};

//执行回调
gs.execTick = function(tick, data) {
    if (tools.isNumber(tick)) {
        if (!!this.callbacks[tick]) {
            this.callbacks[tick](data);
            delete this.callbacks[tick];
            return true;
        }
    }
    return false;
};

//获取服务器
gs.getServerByGID = function(gid) {
    if (!!serversort[gid])
        return serversort[gid];
    return null;
};

function rpcService(call){
    var gids = call.metadata._internal_repr.gid;
    if (!gids || !tools.isArray(gids))  {
        console.log("can't find the gid metadata");
        return call.end();
    }
    var gid = parseInt(gids[0]);
    if (gid  <= 1000) {
        console.log("the gid info is error, now is:", gid);
        return call.end();
    }

    var gserver = serversort[gid];
    if (!gserver) {
        console.log("init gid server:", gid);
        gserver  = new GameServer(gid);
    }

    call.on('data', function(message){
        gserver.onReceivePackData(call, message);
    });

    call.on('end', function(){
        call.end();
    });
}

module.exports = {
    name: "hall",
    beans: [{
        id: "GameServerManager",
        func: GameServerManager,
        scope: "singleton"
    }]
};