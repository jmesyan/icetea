var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/chat.proto'))
var encoder = function(){
    this.handler = {};
    this.handler['room.message'] = messages['UserMessage'];
}

var _proto_ = encoder.prototype;

_proto_.lookup = function(route){
    return  this.handler[route] != undefined;
}

_proto_.build =function(route){
    return  this.handler[route]
}

module.exports = new encoder();