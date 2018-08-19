var log = require('pomelo-logger').getLogger("game", "GameServerManager");
var pomelo = require('pomelo');
var PROTO_PATH = __dirname + "/protos/grpc.proto";
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
const grpcLib = require('@grpc/grpc-js');
const pkgDefine = protoLoader.loadSync(PROTO_PATH);
const protos = grpcLib.loadPackageDefinition(pkgDefine).protos;

var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/protos/chat.proto'));

Buffer.prototype.toByteArray = function () {
   return Array.prototype.slice.call(this, 0)
}

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

function rpcService(call){
    console.log("call come", call.metadata._internal_repr.gid);
    call.on('data', function(message){
        console.log(message, messages.JoinResponse.decode(message.data));
        var data = messages.UserMessage.encode({Name:"jmesyan", Content:"good"});
        var res = {cid:101, cmd:201, n:301, t:401, data:data}
        call.write(res);
    });

    call.on('end', function(){
        call.end();
    });
}
module.exports = GameServerManager;