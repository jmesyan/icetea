var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/chat.proto'))
var decoder = function(){
    this.handler = {};
    this.handler['onMembers'] = messages['AllMembers'];
    this.handler['room.join'] = messages['JoinResponse'];
    this.handler['onMessage'] = messages['UserMessage'];
    this.handler['NewUser'] = messages['NewUser'];
}

var _proto_ = decoder.prototype;

_proto_.lookup = function(route){
    return  this.handler[route] != undefined;
}

_proto_.build =function(route){
    return  this.handler[route]
}

module.exports = new decoder();