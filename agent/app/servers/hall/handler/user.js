var GameConst = require("../../../common/GameConst");
var tools = require("../../../GameUtils/Tools");
var code = require("../../../common/code");
var pomelo = require("pomelo");
var log = require('pomelo-logger').getLogger("hall", "hall.user");

module.exports = function(app) { return new Handler(app); };
var Handler = function(app) { };
var handler = Handler.prototype;

//是否登陆
handler.checkLogin = function(session, next) {
	if (!session.uid) {
		if (next) next(null, {
			code: code.FAIL,
			msg: pomelo.app.get("locale").getLang(session.settings.locale || 'zh_TW', 'notLogin')
		});
		return false
	}
	return true;
};
handler.operatorFailure = function(session, next, key, code) {
	return this.error(session, next, 'operatorFailure', key, code);
};
handler.error = function(session, next, errKey, key, c) {
	key = key || 'code';
	c = c || code.FAIL;
	var err = { msg: pomelo.app.get("locale").getLang(session.settings.locale, errKey) };
	err[key] = c;
	next(null, err);
	return false;
};

//用户进大厅 返回公告信息
handler.enter = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;

	var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
	//返回
	next(null, { code: code.OK, reconnect: player && player.tableid });
};

//喇叭消息
handler.laba = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	//广播给所有在大厅里的用户
	pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall).pushMessage(GameConst.pushCmd.laba, msg);
	next(null, { code: code.OK });
};

//返回大厅
handler.backHall = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	next(null, { code: code.OK });
};

//用户是否在线
handler.checkOnline = function(msg, session, next) {
	var player = pomelo.app.get('usermanager').getOnlineUserSort(msg.uid);
	next(null, { code: player ? code.OK : code.FAIL });
};

//用户聊天
handler.chat = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	if (msg.msg.length > 200) return next(null, {
		code: code.FAIL
	});
	pomelo.app.get('chatService').Chat(session.uid, msg);
	next(null, {
		code: code.OK
	});
};
handler.voice = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get('chatService').Voice(session.uid, msg);
	next(null, {
		code: code.OK
	});
};

handler.createMJRoom = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").createRoom(this, session, msg, next);
};
handler.enterMJRoom = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").enterGameByRoom(this, session, msg, next);
};
handler.getGps = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").getGps(this, session, msg, next);
};
handler.setGps = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").setGps(this, session, msg, next);
};
//代开解散
handler.kfjs = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").kfjs(this, session, msg, next);
};


handler.enterMatch = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").enterMatch(this, session, msg, next);
};
handler.getMatch = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").getMatch(this, session, msg, next);
};

handler.heartbeat = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("mjP2PService").heartbeat(this, session, msg, next);
};
handler.matchSign = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").bsbm(this, session, msg, next);
}
handler.matchUnsign = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").matchUnsign(this, session, msg, next);
}

handler.forceQuitMatch = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").forceQuitMatch(this, session, msg, next);
}
handler.matchSignNum = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").getMatchSignNum(this, session, msg, next);
}
handler.match = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("matchServer").match(this, session, msg, next);
}

handler.enterRoomInvite = function(msg, session, next) {
    if (!this.checkLogin(session, next)) return false;
    pomelo.app.get("mjP2PService").enterRoomInvite(this, session, msg, next);
}

//金币场
handler.createGoldRoom = function(msg, session, next) {
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("goldService").createGoldRoom(this, session, msg, next);
};
handler.leaveGoldPool = function(msg, session, next){
    if (!this.checkLogin(session, next)) return false;
    pomelo.app.get("goldService").leaveGoldPool(this, session, msg, next);
};

//获取当前桌子坐下的人数 旁观的不算
handler.getTablePeopNum = function(msg, session, next){
	if (!this.checkLogin(session, next)) return false;
	pomelo.app.get("goldService").getTablePeopNum(this, session, msg, next);
};


