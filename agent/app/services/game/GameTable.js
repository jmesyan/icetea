var pomelo = require("pomelo");
var log = require('pomelo-logger').getLogger("hall", "GameTable");
var tools = require("../../GameUtils/Tools");

var GameTable = function() { this.init(); };
var gt = GameTable.prototype;

gt.init = function(gsid, obj) {
	var self = this;
	this.gsid = null;
	this.tableid = 0;
	this.code=0;
	this.gsidtid = null;
	this.player_sort = {};
	this.gameserver = null;

	if (!!obj) {
		this.gsid = gsid;
		this.tableid = obj.tid;
		this.gsidtid = this.gsid + "_" + this.tableid;
		this.player_sort = {};

		//把用户索引了
		if ((!!obj.uid) && obj.uid.length)
			obj.uid.forEach(function(user) { self.addPlayer(user); });
	}

	return this;
};

gt.dispose = function() {
	for (var uid in this.player_sort) this.removePlayer(uid);
	this.code=0;
	this.gameserver = null;
};

//getGameServer
gt.getGameServer = function() { return this.gameserver; };

//添加桌子玩家
gt.addPlayer = function(userinfo) {
	tools.FormatGamePlayerInfo(userinfo);
	if (tools.isString(userinfo) || tools.isNumber(userinfo)) {
		var uid = userinfo;
		userinfo = { uid: uid };
	}
	if (!!this.player_sort[uid]) {
		log.error("重复添加玩家{0}到桌子{1}".format(uid, this.gsidtid));
		return;
	}
	var self = this;
	//思考，防止超快速进出突破载入数据速度
	userinfo._tt = tools.getSystemMillSecond();
	userinfo.gsid = self.gsid;
	userinfo.tableid = self.tableid;

	var player = pomelo.app.get('usermanager').getOnlineUserSort(userinfo.uid);
	var gid = self.gsid.split('_')[0];
	if(player && player.type == 1 && gid > 10000) return;

	pomelo.app.get('usermanager').addUserSort(userinfo.uid, null, userinfo);

	player = pomelo.app.get('usermanager').getOnlineUserSort(userinfo.uid);
	player.gsid = self.gsid;
	player.tableid = self.tableid;

	this.player_sort[player.uid] = player;
	//把玩家记录到桌子上
	if(pomelo.app.get('randomAssignGameTable')) pomelo.app.get('randomAssignGameTable').addUserToTable(this.gsidtid, player.uid);
};

//移除桌子玩家
gt.removePlayer = function(userinfo) {
	tools.FormatGamePlayerInfo(userinfo);
	var uid = 0;
	if (tools.isString(userinfo) || tools.isNumber(userinfo)) {
		uid = userinfo;
	} else {
		uid = userinfo.uid;
	}

	if (!!this.player_sort[uid]) {
		var player = this.player_sort[uid];
		var gsidtid = player.gsid + "_" + player.tableid;

		if(this.gsid == player.gsid && this.tableid == player.tableid) {
			delete player.gsid;
			delete player.tableid;
		}
		//delete player.mid;
		delete this.player_sort[uid];
		//彻底清除玩家数据
		pomelo.app.get('usermanager').removeUserSort(uid, true);
	} else {
		var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
		if(player && player.gsid == this.gsid && player.tableid == this.tableid){
			delete player.gsid;
			delete player.tableid;
			pomelo.app.get('usermanager').removeUserSort(uid, true);
		}
	}
	var p2p=pomelo.app.get('mjP2PService');
	if(!!p2p)pomelo.app.get('mjP2PService').removeTableUser(gsidtid, uid);
};

gt.getPlayerCount = function() {
	var len = 0;
	for (var i in this.player_sort) len++;
	return len;
};

module.exports = {
	name: "hall",
	beans: [{
		id: "GameTable",
		func: GameTable
	}]
};