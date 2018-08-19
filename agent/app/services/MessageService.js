var pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger("hall", "MessageService");

var exp = module.exports;

exp.pushMessageByUids = function(uids, route, msg) {
	pomelo.app.get('channelService').pushMessageByUids(route, msg, uids, errHandler);
};

exp.pushMessageToPlayer = function(player, route, msg) {

	var app = pomelo.app;
	var channelService=app.get('channelService');
	var namespace = 'sys';
	var service = 'channelRemote';
	var method = 'pushMessage';
	var successFlag = false;
	var failIds = [];

	var opts = {type: 'push', userOptions:  {}};
	// for compatiblity
	opts.isPush = true;

	var sid=player.sid;
	if(sid === app.serverId) {
		channelService.channelRemote[method](route, msg, [player.uid], opts);
	} else {
		app.rpcInvoke(sid, {namespace: namespace, service: service,
			method: method, args: [route, msg, [player.uid], opts]});
	}

};

function errHandler(err, fails) {
	if (!!err) logger.error('Push Message error! %j', err.stack);
}