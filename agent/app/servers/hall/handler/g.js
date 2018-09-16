var tools = require("../../../GameUtils/Tools");
var log = require('pomelo-logger').getLogger("hall", "hall.g");
var hot = require("../../../services/HotHelper");
var pushCmd = hot.getGameConst().pushCmd;
var CMD = hot.getGameConst().CMD;
var code = hot.getCode();
var pomelo = require("pomelo");

module.exports = function(app) { return new Handler(app); };
var Handler = function(app) { };
var handler = Handler.prototype;

//是否登陆
handler.checkLogin = function(session, next) {
	if (!session.uid) {
		if (next) next(null, {
			code: 0,
			msg: pomelo.app.get("locale").getLang(session.settings.locale || 'zh_TW', 'notLogin')
		});
		return false
	}
	return true;
};

//连接游戏服务器
handler.l = function(msg, session, next) {
	//log.info('hall.g.l', session.uid, msg.gid, msg.rtype, msg.ridx, msg.quick, 'begin');
	if (!this.checkLogin(session, next)) return false;

	//获取用户信息
	pomelo.app.get('usermanager').addUserSort(session.uid).then(function(player) {
		pomelo.app.get("gameserverManager").enterToGame(player, msg, session.settings.locale || 'zh_TW', function(result) {
			if (next) next(null, result);
			//log.info('hall.g.l', session.uid, 'ok!');
		});
	});
};

//c2s 转发客户端消息到服务端
handler.s = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	if (next) next();
	var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
	if (!!player.cid) {
		var channel = pomelo.app.get("gamechannel").getChannel(player.cid);
		if (!!channel) {
			channel.c2s(msg.cmd);
			return;
		}
	}
	//连接不存在，返回踢出大厅信息
	var cmd = CMD.GLID_GAMEITEM_KICKTOHALL | CMD.ACK;

	if (!!player && player.sendMsg) player.sendMsg(pushCmd.game, tools.makeGameMsg(cmd, { result: 0, golds: player.golds }));
	//log.error("no channel found player:{0},msg:{1}".format(JSON.stringify(player), msg.cmd));
};

//退出游戏
handler.o = function(msg, session, next) {
	//log.info('hall.g.o', session.uid);
	if (!this.checkLogin(session, next)) return false;
	var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
	var channel = pomelo.app.get("gamechannel").getChannel(player.cid);
	if (!!channel) {
		//log.info('hall.g.o', 'logoutGame', player.cid);
		channel.logoutGame(true);
		if (next) next(null, { code: code.OK });
	} else {
		if (next) next(null, { code: code.CHANNEL.NOT_FOUND });
	}
};
