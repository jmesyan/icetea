var log = require('pomelo-logger').getLogger('hall', 'userRemote');
var Code = require('../../../common/code');
var pomelo = require('pomelo');

//频道规划
var ChanelName = require("../../../common/GameConst").ChanelName;
var pushCmd = require("../../../common/GameConst").pushCmd;

module.exports = function(app) { return new Remote(app); };
var Remote = function(app) {};
var remote = Remote.prototype;

//添加用户到hall chanel/sid=>server id
remote.add = function(user, sid, cb) {
	var uid = user.uid;

	//载入用户数据并加入用户索引
	pomelo.app.get("usermanager").addUserSort(uid, sid, user).then(function(player) {
		player.enter_time = Math.round(+new Date() / 1000);
	});

	var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
	player.joinChannel(ChanelName.hall);
	pomelo.app.get("gameserverManager").reconnectToGame(player);
	if (cb) cb(player);
};

//移除玩家，玩家主动断线登出/sid=>server id
remote.remove = function(uid, sid, cb) {
	var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
	if (!!player) {
		if (!player.uid) log.error("wrong user info in remove!{0}".format(uid));
		//log.warn("remove success leave user {2} {1}({0})".format(player.uid, player.nickname, player.sid));

		player.leaveChannel();
		player.updateUserOnlineTime();

		pomelo.app.get("usermanager").removeUserSort(uid);
		pomelo.app.rpc.db.dbRemote.deleteUserOnline(null, uid);
		pomelo.app.get('matchServer').removeMatchUser(uid);
		pomelo.app.get("goldService").removePoolUser(uid);

		//游戏channel，需要销毁
		if (!!player.cid) {
			//log.info('reconnectToGame', 'userRemote.remove', player.cid);
			var channel = pomelo.app.get("gamechannel").getChannel(player.cid);
			if (channel) channel.logoutGame(true);
		}
	} else {
		//这是什么情况？
	}
	if (cb) cb(null);
};

//踢人
remote.kick = function(uid, state, cb) {
	var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
	if (!!player) {
		if (!player.uid) log.error("wrong user info in kick !{0}".format(uid));
		//log.warn("kick success leave user {2} {1}({0})".format(player.uid, player.nickname, player.sid));

		player.sendMsg(pushCmd.quit, { state: state });
		if (cb) cb(Code.OK);
	} else {
		//这是什么情况？
		if (cb) cb(Code.FAIL);
	}
};

//踢人
remote.quit = function(uid,cb){
	var player = pomelo.app.get("usermanager").getOnlineUserSort(uid);
	if(player && player.sid){
		if (!player.uid) log.error("登录大厅检查已存在用户信息错误!{0}".format(JSON.stringify(user)));
		//log.warn("kick success leave user {2} {1}({0})".format(player.uid, player.nickname, player.sid));
		player.sendMsg(pushCmd.quit, { state: Code.QUIT.DUPLICATE_LOGIN});
		//player.kick("用户从别处登录");
		player.kick(Code.QUIT.DUPLICATE_LOGIN);
	}
	cb();
}