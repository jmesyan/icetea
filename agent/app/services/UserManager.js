var log = require('pomelo-logger').getLogger("hall", "UserManager");
var pomelo = require('pomelo');

var tools = require("../GameUtils/Tools");
var Promise = require("bluebird");

var hotHelper = require("./HotHelper");
var CPlayer = hotHelper.getGamePlayer();
var GameChannel = hotHelper.getGameChannelManager();
var GameConst = hotHelper.getGameConst();

var UserManager = function() {};
var manager = UserManager.prototype;

//在线玩家数据的索引
var users = require("./StoreDatas").users;

//添加到玩家索引
manager.addUserSort = function(uid, sid, userinfo) {
	if (userinfo && userinfo.nickname) userinfo.nickname = tools.decodeNickName(userinfo.nickname);

	if (!!users[uid]) {
		users[uid].init(userinfo);
		if (!!sid) {
			users[uid].sid = sid;
			if(!!users[uid].reload) delete users[uid].reload;
		}
	} else {
		var user = { uid: uid };
		tools.extend(user, userinfo);

		user = CPlayer(user);
		users[uid] = user;
		if (!!sid) users[uid].sid = sid;
	}

	users[uid].create_time = tools.getSystemMillSecond();
	if (users[uid].login_date && users[uid].login_date > 0) return Promise.resolve(users[uid]);

	return pomelo.app.get('cache').getUser(uid).then(function(user) {
		if (!user || uid != user.uid) log.error('getUser read db error:', uid, user?user.uid:'用户不存在！');

		if (!!users[uid]) {
			users[uid].init(user);
			return users[uid];
		} else {
			user = CPlayer(user);
			users[uid] = user;
			if (!!sid) users[uid].sid = sid;
			users[uid].init(user);
			return users[uid];
		}
	});
};

/**
 * 游戏中用户信息
 * @param uid
 * @returns {Player}
 */
manager.getOnlineUserSort = function(uid) {
	if (!!users[uid]) return users[uid];
	return false;
};

//移除玩家索引
manager.removeUserSort = function(uid, fromGame) {
	if (!!users[uid]) {
		var user = users[uid];

		//如果不是游戏发起的删除，则是大厅发起，先清理sid
		if (!fromGame) delete user.sid;

		//玩家仍在游戏中，搬迁到deleting
		//只有不在游戏同时不在大厅,不在比赛，彻底删除
		if (!user.gsid) {
			if (user.cid) {
				log.info('removeUserSort', 'logoutGame', user.cid);
				var channel = GameChannel.getChannel(user.cid);
				channel.logoutGame();
			}
			if(!user.mid && !user.sid) delete users[uid];
		}
		return user;
	}
	return false;
};

//改变筹码
manager.changeOnlineUserGolds = function(uid, golds) {
	pomelo.app.get('cache').removeUser(uid);
	var user = this.getOnlineUserSort(uid);
	if (!!user) {
		log.info('changeOnlineUserGolds', uid, golds, user.golds);
		user.init({
			golds: golds
		});

		user.sendMsg(GameConst.pushCmd.changeGolds, { golds: parseInt(user.golds) });
	}
	return user;
};

module.exports = {
	name: "hall",
	beans: [{
		id: "UserManager",
		func: UserManager,
		scope: "singleton"
	}]
};