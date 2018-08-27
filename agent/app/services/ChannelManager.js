var pomelo = require("pomelo");

var log = require('pomelo-logger').getLogger("hall", "ChannelManager");
var tools = require("../GameUtils/Tools");
var GameConst = require("../common/GameConst");

var sys = require("./StoreDatas").sys;
var users = require("./StoreDatas").users;

var ChannelManager = function() {
	this.$id = "ChannelManager";
	this.$scope = "singleton";
};
var cm = ChannelManager.prototype;
//广播玩家状态改变
cm.broadcastPlayerChangeOnlineState = function(uid, gid, rtype, ridx, tableid, pos) {
	var data = {
		uid: uid,
		gsid: ((gid || 0) + '_' + (rtype || 0) + '_' + (ridx || 0)),
		tid: parseInt(tableid || 0),
		pos: parseInt(pos || 0)
	};
	var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall);
	if (!!channel) channel.pushMessage(GameConst.pushCmd.changeOnlineState, data);
};
//广播玩家下线
cm.broadcastPlayerRemoveOnline = function(uid) {
	var data = { uid: uid };
	var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall);
	if (!!channel) channel.pushMessage(GameConst.pushCmd.removeOnline, data);
};
//广播玩家聊天
cm.broadcastPlayerChat = function(data) {
	var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall);
	if (!!channel) channel.pushMessage(GameConst.pushCmd.agentChat, data);
};
//广播停机维护
cm.broadcastPlayerServerReboot = function(data) {
	var time = this.sysMaintenance();
	if (time > 0) {
		for (var key in users) {
			var user = users[key];
			var tableid = user.tableid || 0;
			if (tableid > 0) continue;
			//log.info('serverReboot', key, data.time);
			user.sendMsg(GameConst.pushCmd.serverReboot, data);
		}
	}
};
cm.playerServerReboot = function(uid, data) {
	var player = users[uid];
	var time = this.sysMaintenance();
	if (player && player.tableid == 0 && time > 0) {
		player.sendMsg(GameConst.pushCmd.serverReboot, {time:time});
	}
};
//广播更新版本
cm.broadcastPlayerUpdateClient = function(data) {
	var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall);
	if (!!channel) channel.pushMessage(GameConst.pushCmd.updateClient, data);
};
cm.sysMaintenance = function() {
	if (sys.MAINTENANCE_TIME2 && sys.SYS_MAINTENANCE) {
		var time = Math.round(+new Date() / 1000);
		if (time < sys.MAINTENANCE_TIME2) return sys.MAINTENANCE_TIME2 - time;
	}
	return 0;
};
//服务器断开
cm.broadcastPlayerServerLeave = function(data) {
	var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall, true);
	if (!!channel) channel.pushMessage(GameConst.pushCmd.serverLeave, data);
};

module.exports = ChannelManager;