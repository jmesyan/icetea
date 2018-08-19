var fs = require('fs');
var protobuf = require('protocol-buffers');
var log = require('pomelo-logger').getLogger("hall", "ProtoManager");

var protoMsg = require("./StoreDatas").protoMsg;
var protoFile = __dirname + "/../../config/qcloud.proto";

var ProtoManager = function() {
	//标识单例
	this.$scope = "singleton";
	var self = this;
	fs.watch(protoFile, function(event, name) {
		if (event === 'change') self.reloadData();
	});
	this.init();
};

var pm = ProtoManager.prototype;

pm.reloadData = function() {
	protoMsg = null;
	protoMsg = protobuf(fs.readFileSync(protoFile));
	log.warn("Load proto", protoFile, "file ok!");
};

pm.getBody = function(cmd, data) {
	if (!protoMsg[cmd]) {
		log.error('protobuf not found:', cmd);
		return null;
	}
	var result = null;
	try {
		result = protoMsg[cmd].decode(data);
	} catch (e) {
		log.error('protobuf decode error:', cmd, data);
	}
	return result;
};

pm.init = function() {
	this.reloadData();
};

module.exports = {
	name: "hall",
	beans: [{
		id: "ProtoManager",
		func: ProtoManager,
		runupdate: 'init',
		scope: "singleton"
	}]
};