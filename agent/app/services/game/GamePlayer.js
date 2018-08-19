var log = require('pomelo-logger').getLogger("hall", "Player");
var pomelo = require('pomelo');
var messageService = require('../MessageService');
var tools = require("../../GameUtils/Tools");
var GameConst = require("../../common/GameConst");

var Player = function(user) {
	if (!(this instanceof Player)) return new Player(user);
	this.sid=null;
	this.tableid=null;
	this.uid=0;
	this.cid=0;
	this.enter_time=0;
	this.create_time=0;
	this.init(user);
};

Player.prototype.init = function(user) {
	if (!!user) {
		tools.FormatGamePlayerInfo(user);
		tools.extend(this, user);
	}
	if (!this.channels) this.channels = {};
};

//更新在线时长
Player.prototype.updateUserOnlineTime = function() {
	if (!this.enter_time) this.enter_time = Math.round(+new Date() / 1000);
	pomelo.app.rpc.db.dbRemote.updateUserOnlineTime(null, this.uid, this.enter_time);
};

//加入 hall channel
Player.prototype.joinChannel = function(channelName) {
	if (!!this.channels[channelName]) {
		//log.info("user {0} duplicate join channel {1}".format(this.uid, channelName));
	} else {
		this.channels[channelName] = tools.getSystemMillSecond();
		//log.info("user {0} join channel {1}".format(this.uid, channelName));
		var channel = pomelo.app.get('channelService').getChannel(channelName, true);
		if (!!channel) channel.add(this.uid, this.sid);
	}
};

//离开 hall channel
Player.prototype.leaveChannel = function(channels) {
	var channelName = null;
	if (tools.isString(channels)) {
		channelName = channels;
	} else {
		for (var k in this.channels) this.leaveChannel(k);
		return;
	}

	if (!!this.channels[channelName]) {
		var channel = pomelo.app.get('channelService').getChannel(channelName, false);
		var jointime = this.channels[channelName];
		delete this.channels[channelName];
		if (!!channel) {
			//记录离开的时间
			//log.info("user {0} leave channel {1} jointime:{2} - {3}".format(this.uid, channelName, tools.getDateKey(parseInt(jointime / 1000), "YYYY-MM-DD HH:mm:ss"), this.sid));
			channel.leave(this.uid, this.sid);
		} else {
			var errorinfo = "not found channel error {0} to {1}".format(this.uid, channelName);
			log.error(errorinfo);
			throw new Error(errorinfo);
		}
	} else {
		var errorinfo = "leave channel error {0} to {1}".format(this.uid, channelName);
		log.error(errorinfo);
		throw new Error(errorinfo);
	}
};

//获取用户 所在的 hall channel
Player.prototype.getChannels = function() {
	var c = [];
	for (var k in this.channels) c.push(k);
	return c;
};

//主动给用户发消息
Player.prototype.sendMsg = function(route, msg) {
	if (!!this.sid) messageService.pushMessageToPlayer(this, route, msg);
};

Player.prototype.kick=function(reason){
	if(!!this.sid)pomelo.app.backendSessionService.kickByUid(this.sid,this.uid,reason)
};
Player.prototype.setHubSid=function (hubsid, cb) {
	pomelo.app.rpc.connector.gateRemote.setSessionKV.toServer(this.sid,this.uid,{gamehubServerid:hubsid},cb);
};
module.exports = {
	name: "hall",
	beans: [{
		id: "Player",
		func: Player
	}]
};