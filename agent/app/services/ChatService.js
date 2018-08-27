var log = require('pomelo-logger').getLogger("hall", "ChatService");
var pomelo = require('pomelo');
var tools = require("../GameUtils/Tools");
var Promise = require("bluebird");

var GameConst = require("../common/GameConst");

var ChatService = function() {
	this.$id = "ChatService";
	this.$scope = "singleton";
	this.init();
};

var service = ChatService.prototype;

service.init = function(){

};

service.Chat = function(uid, msg){
	if (msg.to) {
		var me = pomelo.app.get("usermanager").getOnlineUserSort(uid);
		var to = pomelo.app.get("usermanager").getOnlineUserSort(msg.to);
		if (!!me && !!to) {
			to.sendMsg(GameConst.pushCmd.chat, {
				uid: me.uid,
				nn: me.nickname,
				msg: msg.msg,
				type: 0
			});
		}
	} else {
		var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
		if (!!player && player.gsid && player.tableid) {
			var tid = player.gsid + '_' + player.tableid;
			var table = pomelo.app.get("gameserverManager").getTable(tid);
			var nn = player.nickname;
			if (!!table) {
				for (var i in table.player_sort) {
					var p = table.player_sort[i];
					if (p.uid == uid) continue;
					p.sendMsg(GameConst.pushCmd.chat, {
						uid: uid,
						nn: nn,
						msg: msg.msg,
						type: 1
					});
				}
			}
		}
	}
};
service.Voice = function(uid, msg){
	var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
	if (!!player && player.gsid && player.tableid) {
		var tid = player.gsid + '_' + player.tableid;
		var table = pomelo.app.get("gameserverManager").getTable(tid);
		var nn = player.nickname;
		if (!!table) {
			for (var i in table.player_sort) {
				var p = table.player_sort[i];
				if (p.uid == uid) continue;
				p.sendMsg(GameConst.pushCmd.voice, {
					uid: uid,
					nn: nn,
					msg: msg.msg
				});
			}
		}
	} else {
		log.error('voice game no uid ->', uid);
	}
};

module.exports = {
	name: "hall",
	beans: [{
		id: "ChatService",
		func: ChatService,
		scope: "singleton"
	}]
};