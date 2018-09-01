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

var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/protos/chat.proto'));

var GameConst = require("./HotHelper").getGameConst();
var CMD = GameConst.CMD;

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
    var gsids = call.metadata._internal_repr.gsid;
    if (!gsids || !tools.isArray(gsids))  {
        console.log("can't find the gid metadata", gsids);
        return call.end();
    }
    var gid = parseInt(gsids[0]), rtype = parseInt(gsids[1]), ridx = parseInt(gsids[2]);
    if (gid  <= 1000 || rtype < 0 || ridx < 0) {
        console.log("the gid info is error, now is:", gid, rtype, ridx);
        return call.end();
    }
    gsid = gid + "_" + rtype + "_" + ridx;
    console.log("the gsid is:", gsid, gid,rtype,ridx)
    var gserver = serversort[gsid];
    if (!gserver) {
        console.log("init gsid server:", gsid);
        var GameServer = hot.getGameServer();
        gserver  = new GameServer(call);
        gserver.init(ridx, rtype, gid);
    }

    call.on('data', function(message){
        gserver.onReceivePackData(call, message);
    });

    call.on('end', function(){
        gserver.dispose();
    });
    
    setTimeout(function(){
        gserver.notify(0,"room.join", "control_match_android_sign", {uid:1234, mid:23223, mlid:212121});
    }, 300);
}

function dealRoom(body){
    console.log("the dealRoom come:", JSON.stringify(body));
}



module.exports = {
    name: "hall",
    beans: [{
        id: "GameServerManager",
        func: GameServerManager,
        scope: "singleton"
    }]
};