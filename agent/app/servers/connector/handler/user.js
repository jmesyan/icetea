var log = require('pomelo-logger').getLogger('connector', 'connector.user');
var async = require("async");
var Code = require("../../../common/code");
var pomelo = require("pomelo");
var pushCmd = require("../../../common/GameConst").pushCmd;

module.exports = function(app) { return new Handler(app); };
var Handler = function(app) {};
var handler = Handler.prototype;

//连接
handler.login = function(msg, session, next) {
	var t = Date.now();
	log.info('connector.user.login', msg.uid, 'begin');

	var uid = parseInt(msg.uid, 10);
	var username = msg.un;
	var nickname = msg.nn;
	var key = msg.key;
	var keysplit = key.split("|");
	var isMobile = 0;
	var mobileMode = "pc";
	var locale = "en_US";
	var address = pomelo.app.get('sessionService').getClientAddressBySessionId(session.id);

	async.waterfall([
		function(cb) {
			//移动参数附加
			if (keysplit.length > 1) {
				key = keysplit[0];
				if (keysplit.length > 1) isMobile = parseInt(keysplit[1]);
				if (keysplit.length > 2) mobileMode = keysplit[2];
				if (keysplit.length > 3) locale = keysplit[3];
			}
			//验证成功
			if (uid && key == pomelo.app.get("tools").MD5(uid + username + nickname + "realbullgame")) {
				cb();
			} else {
				next(null, { msg: "key not permit!", code: Code.FAIL, error: true });
			}
		},
		function(cb) {
			//duplicate log in
			var oldsession = pomelo.app.get('sessionService').getByUid(uid);
			if(uid == 12626) log.info('oldsession',uid,oldsession);
			if (!!oldsession && oldsession.length > 0) {
				//向老客户端发送踢人命令
				sendMsgByUid(uid, pushCmd.quit, { state: Code.QUIT.DUPLICATE_LOGIN, id: oldsession[0].id });
				pomelo.app.get('sessionService').kick(uid, Code.QUIT.DUPLICATE_LOGIN, cb);
			} else {
				pomelo.app.rpc.hall.userRemote.quit(session, uid, cb);
			}
		},
		function(cb) {
			session.bind(uid, cb);
		},
		function(cb) {
			session.on('closed', onUserLeave);
			session.set('uid', uid);
			session.set('username', username);
			session.set('nickname', nickname);

			session.set('key', key);
			session.set('locale', locale);
			session.set('isMobile', isMobile);
			session.set('mobileMode', mobileMode);

			session.pushAll();

			var user = {
				uid: uid,
				username: username,
				nickname: nickname,
				key: key,
				ip: address.ip,
				locale: locale,
				isMobile: isMobile,
				mobileMode: mobileMode
			};

			pomelo.app.components.__connection__.updateUserInfo(uid, user);
			//通知后端加载用户信息并推送
			pomelo.app.rpc.hall.userRemote.add(session, user, pomelo.app.get('serverId'));
			cb();
		}
	], function(err) {
		log.info('connector.user.login', session.uid, err?'error!':'ok!', '用时：', Date.now() - t, 'ms');
		if (err) {
			next(err, { code: Code.FAIL, error: err });
			return;
		}
		//记录进入大厅
		pomelo.app.rpc.db.dbRemote.addUserOnline(null, { uid: session.uid });
		next(null, { code: Code.OK, msg: "ok", id: session.id });
	});
};

//心跳
handler.heartBeat = function(msg, session, next) {
	next(null, { code: Code.OK, t: msg.t || 0 });
};

//退出
var onUserLeave = function(session, reason) {
	if (!session || !session.uid) return;

	if (reason != Code.QUIT.DUPLICATE_LOGIN) {
		pomelo.app.rpc.hall.userRemote.remove(session, session.get("uid"), pomelo.app.get('serverId'), function() { session.unbind(session.uid); });
	} else {
		log.warn("kick success leave user {2} {1}({0})".format(session.uid, session.get("nickname"), pomelo.app.get('serverId')));
		session.unbind(session.uid);
	}
};

var coder = require("pomelo/lib/connectors/common/coder");

function sendMsgByUid(uid, route, msg) {
	log.info(uid, route, JSON.stringify(msg));
	pomelo.app.get("sessionService").sendMessageByUid(uid, coder.encode(null, route, msg));
}

//重启前全面发送信息
process.on('exit', function() {
	pomelo.app.get("sessionService").forEachSession(function(session) {
		session.send(coder.encode(null, pushCmd.quit, { state: Code.QUIT.SERVER_MATAINING }));
	});
});