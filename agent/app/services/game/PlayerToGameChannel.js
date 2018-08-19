var pushCmd = require("../../common/GameConst").pushCmd;
var pomelo = require('pomelo');
var Tools = require('../../GameUtils/Tools');

var log = require('pomelo-logger').getLogger("hall", "PlayerToGameChannel");
var channelid = 1;
var MAX_CID = 0xFFFFFFF;
var channels = require("../StoreDatas").channels;
var uidToCid = require("../StoreDatas").uidToCid;

var hothelper = require("../HotHelper");
var GameChannelManager = function() {};

/**
 * 创建channel
 * @param {GamePlayer} player
 * @param {GameServer} server
 * @returns {PlayerToGameChannel}
 */
GameChannelManager.prototype.createChanel = function createChanel(player, server) {
	var pc = hothelper.getPlayerToGameChannel();
	var channel = new pc();
	channel.init(player, server);
	channels[channel.id] = channel;
	return channel;
};

/**
 * 删除channel
 * @param cid
 * @returns {boolean}
 */
GameChannelManager.prototype.destroyChannel = function(cid) {
	var channel = hothelper.getChannelManager().getChannel(cid);
	if (!!channel) {
		channel.destroy();
		return true;
	}
	return false;
};

/**
 * 获取channel
 * @param cid
 * @returns {PlayerToGameChannel}
 */
GameChannelManager.prototype.getChannel = function getChannel(cid) {
	if (!!channels[cid]) return channels[cid];
	return false;
};

GameChannelManager.prototype.updateSet = function() {
	pomelo.app.set("gamechannel", hothelper);
};

//建立玩家到服务器的通讯通道
var PlayerToGameChannel = function() {
	if (!(this instanceof PlayerToGameChannel)) {
		if (arguments[0] instanceof PlayerToGameChannel) return arguments[0];
		if (arguments.length == 2) return hothelper.getChannelManager().createChanel(arguments[0], arguments[1]);
		return false;
	}
	this.inited = false;
};
var c = PlayerToGameChannel.prototype;

c.init = function(player, server) {
	//循环生成id
	while (!!channels[channelid]) {
		channelid++;
		if (channelid > MAX_CID) channelid = 1;
	}
	this.id = channelid;
	this.idstr = this.packInt(this.id);

	this.gamesid = 0;
	this.gamesidstr = "00000";
	this.setPlayer(player).setServer(server);
};

c.packInt = function(num) {
	num = parseInt(num, 10);
	return ("0000000000" + num).substr(-10, 10);
	return String.fromCharCode(channelid & 0xFF) +
		String.fromCharCode((channelid >> 8) & 0xFF) +
		String.fromCharCode((channelid >> 16) & 0xFF) +
		String.fromCharCode(channelid >> 24);
};
/**
 *
 * @param {GamePlayer} player
 * @returns {PlayerToGameChannel}
 */
c.setPlayer = function(player) {
	if (!!player) {
		this.player = player;
		this.uidstr = this.packInt(this.player.uid);
		this.ciduidstr = this.idstr + this.uidstr;
	}
	this.checkInit();
	return this;
};

c.setGameSessionId = function(sid) {
	this.gamesid = parseInt(sid, 10);
	this.gamesidstr = ("00000" + sid).substr(-5, 5);
};

c.setServer = function(server) {
	if (!!server) this.server = server;
	this.checkInit();
	return this;
};

c.checkInit = function() {
	if ((!!this.player) && (!!this.server)) {
		this.inited = true;
		uidToCid[this.player.uid] = this.id;
		this.player.cid = this.id;
		//1.19日热更新补充
		if (!this.server.channels) this.server.channels = {};
		this.server.channels[this.id] = this;
	} else {
		this.inited = false;
	}
};
c.traceError = function() { return false; };

//登录游戏
c.loginGame = function(serverData, tick, isretry) {
	if (!this.inited) return this.traceError();
	this.serverData = serverData;

	var player = this.player;
	var tid = serverData.tableid || 0;
	var quick = serverData.quick || 0;
	var quicksit = serverData.quicksit || 0;
	var deviceModel = !!player.mobileMode ? deviceModel = player.mobileMode.toLowerCase() : "pc";
	var self = this;
	var usertype = ""; //保留
	var bfrom = deviceModel.substr(0, 4) == "ipad" ? 2 : (deviceModel == "pc" ? 0 : 1);
	var firstin = 0;
	var outgolds = 0;
	var intime = 0;
	var name = Tools.decodeNickName(player.nickname);
	var gobj = serverData.gobj ? serverData.gobj : {};
	gobj.use_avatar = player.use_avatar;

	if(!!serverData.stype) gobj.stype = serverData.stype;

	gobj = JSON.stringify(gobj);

	if(!!player.motor && player.motor == 1) usertype = 4;

	var process = function(r) {
		outgolds = r && r.score ? r.score : 0;
		var instate = parseInt(serverData.state) || 4;

		if(instate == 1) outgolds = parseInt(serverData.initscore) || 0;

		var motor = parseInt(serverData.motor) || 0;
		if(motor == 1) usertype = 4;

		if(!!serverData.scorescale && instate != 1) outgolds = Math.ceil(outgolds*serverData.scorescale);

		//03VERFtick|uid|username|nickname|sex|usertype|tableid|bfrom|ip|quick|quicksit\firstin|outgolds|intime
		var msg = "{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}|{11}|{12}|{13}|{14}|{15}".format(
				tick, player.uid, player.username, name, player.gender, usertype,
				tid, bfrom, player.login_ip || player.ip, quick, quicksit,
				firstin, outgolds, intime, player.use_prop, gobj);
		//获取code,非开房的其他游戏屏蔽
		var code = hothelper.getMahjongP2PService().getCode(serverData.gsidtid);
		if (!code) code = 0;

		//发送到gamehub
		if(!self.server) {
			log.info('uid',player.uid);
			log.info('serverData',serverData);
			self.server = pomelo.app.get('gameserverManager').getServerByGSID(serverData.gsid);
		}

		if(player.sid == null || player.sid == 'undefined'){
			var connectorServers = pomelo.app.getServersByType('connector');
			var index = Math.floor(Math.random() * connectorServers.length)
			player.sid = connectorServers[index].id;
			player.reload = 1;
			log.info('player.sid',player.sid);
		}

		log.warn('user enter', player.uid, player.mid,player.mlid,outgolds,JSON.stringify(serverData), self.id,player.sid);

		self.server.rpc("channelLogin", self.id, player.uid, player.sid, serverData.gsid, msg, tick, code, tid);
		if (isretry) log.warn(msg);
	};

	if (serverData.gid > 10000) {
		var mlid = parseInt(player.mlid) || 0;
		//log.info('比赛分数',serverData.mid, mlid, player.uid);
		pomelo.app.rpc.db.dbRemote.getUserMatchScore(null, serverData.mid, mlid, player.uid, process);
	} else process();
	return true;
};

//退出游戏
c.logoutGame = function(destroy) {
	if(!!this.server)this.server.rpc("channelLogout",this.id,destroy?true:false);
	if (destroy) this.destroy(destroy);
};

//客户端转服务端
c.c2s = function(msg, cmd) {
	//00common 01 create 02destroy
	if (!this.inited) return this.traceError();

	cmd = cmd || "00";
	msg = "04AAAA" + this.gamesidstr + cmd + this.ciduidstr + msg;
	this.server.sendString(msg);
	return msg;
};

//服务端转客户端
c.s2c = function(cmd, msg) {
	if (!this.inited) return this.traceError();
	//不存在serverid就不要发了
	if (!!this.player.sid) this.player.sendMsg(pushCmd.game, { cmd: cmd, body: msg.toString('base64') });
	return this;
};

/**
 * 销毁
 * @param {Boolean} NoRemoteMsg 不向hub发送指令
 */
c.destroy = function(NoRemoteMsg) {
	//远程调用
	if(!NoRemoteMsg){
		if(!!this.server)this.server.rpc("channelDestory",this.id);
	}
	this.inited = false;
	if (!!this.server) {
		if (!!this.server.channels) delete this.server.channels[this.id];
		delete this.server;
	}
	if (!!this.player) {
		delete this.serverData;
		delete this.player.cid;
		delete uidToCid[this.player.uid];
		delete this.player;
	}
	if (!!this.id) {
		delete channels[this.id];
		delete this.id;
	}
};

module.exports = {
	name: "hall",
	beans: [{
		id: "GameChannelManager",
		func: GameChannelManager,
		scope: "singleton"
	}, {
		id: "PlayerToGameChannel",
		func: PlayerToGameChannel
	}]
};